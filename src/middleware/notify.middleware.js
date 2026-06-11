// created by farah
const notifService = require("../modules/notification/notification.service");
const auditService = require("../modules/audit/audit.service");
const { getClientIp } = require("../utils/ip");

const db = require("../config/db");

// ==========================================
// HELPER — get actor info from req.user
// ==========================================
function getActor(req) {
  const user = req.user;
  if (!user) return { actor_id: null, actor_name: "System", actor_role: null };
  return {
    actor_id: user.id || user.user_id || null,
    actor_name:
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      user.email ||
      "Unknown",
    actor_role: user.role || null,
  };
}

function getIP(req) {
  return getClientIp(req);
}

// ==========================================
// HELPER — get all user_ids by role
// ==========================================
async function getUsersByRole(role) {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id 
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = ? AND u.is_active = 1`,
      [role],
    );
    return rows.map((r) => r.user_id);
  } catch (err) {
    console.error("⚠️ getUsersByRole error:", err.message);
    return [];
  }
}

// ==========================================
// HELPER — notify multiple users
// ==========================================
async function notifyMany(userIds, payload) {
  for (const user_id of userIds) {
    await notifService.createNotification({ user_id, ...payload });
  }
}

// ==========================================
// HELPER — get doctor_id from study
// ==========================================
async function getDoctorFromStudy(study_id) {
  try {
    const [rows] = await db.query(
      `SELECT p.doctor_id FROM studies s
       JOIN patients p ON s.national_id = p.national_id
       WHERE s.study_id = ?`,
      [study_id],
    );
    return rows[0]?.doctor_id || null;
  } catch {
    return null;
  }
}

// ==========================================
// HELPER — get receptionist_id from study
// ==========================================
async function getReceptionistFromStudy(study_id) {
  try {
    const [rows] = await db.query(
      `SELECT created_by FROM studies WHERE study_id = ?`,
      [study_id],
    );
    return rows[0]?.created_by || null;
  } catch {
    return null;
  }
}

// ==========================================
// NOTIFY + AUDIT AFTER RESPONSE SENT
// KEY FIX: use res.on("finish") instead of overriding res.json
// ==========================================
function notifyAfter(handler) {
  return (req, res, next) => {
    res.on("finish", () => {
      // Only process successful responses
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const actor = getActor(req);
      const ip = getIP(req);
      const study_id = req.params?.study_id || req.body?.study_id || null;
      const national_id =
        req.params?.national_id || req.body?.patient?.national_id || null;

      // Fire and forget — non-blocking
      handler({
        req,
        body: res._responseBody || {},
        actor,
        ip,
        study_id,
        national_id,
      }).catch((err) =>
        console.error("⚠️ notify middleware error:", err.message),
      );
    });

    // Intercept res.json to capture the body
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      res._responseBody = body;
      return originalJson(body);
    };

    next();
  };
}

// ==========================================
// ===  SPECIFIC MIDDLEWARES  ===
// ==========================================

// ---------- AI Completed ----------
exports.onAIRun = notifyAfter(async ({ req, body, actor, ip, study_id }) => {
  const doctorId = await getDoctorFromStudy(study_id);
  if (doctorId) {
    await notifService.createNotification({
      user_id: doctorId,
      type: "ai_completed",
      title: "AI Analysis Completed",
      message: `AI analysis for study #${study_id} is ready. Diagnosis: ${body.data?.diagnosis || "N/A"}`,
      study_id,
    });
  }

  await auditService.log({
    ...actor,
    action: "AI_RUN",
    entity: "Study",
    entity_id: study_id,
    description: `AI analysis ran on study #${study_id}. Result: ${body.data?.diagnosis || "N/A"}`,
    ip_address: ip,
  });
});

// ---------- AI Validated ----------
exports.onAIValidate = notifyAfter(
  async ({ req, body, actor, ip, study_id }) => {
    const action = req.body?.action;

    await auditService.log({
      ...actor,
      action: `AI_${action?.toUpperCase()}`,
      entity: "Study",
      entity_id: study_id,
      description: `AI result ${action}d for study #${study_id}`,
      ip_address: ip,
    });
  },
);

// ---------- AI Edited ----------
exports.onAIEdit = notifyAfter(async ({ req, body, actor, ip, study_id }) => {
  const doctorId = await getDoctorFromStudy(study_id);
  const changed = Object.keys(req.body || {}).filter((k) =>
    ["ejection_fraction", "wall_thickness", "has_hfref", "has_lvh"].includes(k),
  );

  if (doctorId) {
    await notifService.createNotification({
      user_id: doctorId,
      type: "ai_edited",
      title: "AI Result Edited",
      message: `Fields updated in study #${study_id}: ${changed.join(", ")}`,
      study_id,
    });
  }

  await auditService.log({
    ...actor,
    action: "AI_EDIT",
    entity: "Study",
    entity_id: study_id,
    description: `Fields edited: ${changed.join(", ")} on study #${study_id}`,
    ip_address: ip,
  });
});

// ---------- Report Signed ----------
exports.onReportFinalized = notifyAfter(
  async ({ req, body, actor, ip, study_id }) => {
    const doctorId = await getDoctorFromStudy(study_id);
    const receptionistId = await getReceptionistFromStudy(study_id);
    const adminIds = await getUsersByRole("Admin");

    if (doctorId) {
      await notifService.createNotification({
        user_id: doctorId,
        type: "report_signed",
        title: "Report Finalized",
        message: `Report for study #${study_id} has been signed and study marked as completed.`,
        study_id,
      });
    }

    if (receptionistId && receptionistId !== doctorId) {
      await notifService.createNotification({
        user_id: receptionistId,
        type: "report_signed",
        title: "Report Finalized",
        message: `Report for study #${study_id} has been signed and the study is now completed.`,
        study_id,
      });
    }

    await notifyMany(adminIds, {
      type: "report_signed",
      title: "Report Signed",
      message: `${actor.actor_name} signed and finalized report for study #${study_id}`,
      study_id,
    });

    await auditService.log({
      ...actor,
      action: "REPORT_SIGNED",
      entity: "Report",
      entity_id: study_id,
      description: `Report signed and study #${study_id} completed`,
      ip_address: ip,
    });
  },
);

// ---------- Report Downloaded/Exported ----------
exports.onReportAccess = async (req, res, next) => {
  res.on("finish", async () => {
    if (res.statusCode === 200) {
      const actor = getActor(req);
      const study_id = req.params?.study_id;
      const adminIds = await getUsersByRole("Admin");

      await notifyMany(adminIds, {
        type: "report_downloaded",
        title: "Report Exported",
        message: `${actor.actor_name} (${actor.actor_role}) exported the PDF report for study #${study_id}`,
        study_id,
      });

      auditService.log({
        ...actor,
        action: "EXPORT",
        entity: "Report",
        entity_id: study_id,
        description: `Report PDF exported for study ${study_id}`,
        ip_address: getIP(req),
      });
    }
  });
  next();
};

// ---------- Image Uploaded ----------
exports.onImageUpload = notifyAfter(
  async ({ req, body, actor, ip, study_id }) => {
    const doctorId = await getDoctorFromStudy(study_id);
    const receptionistId = await getReceptionistFromStudy(study_id);

    if (doctorId) {
      await notifService.createNotification({
        user_id: doctorId,
        type: "image_uploaded",
        title: "Images Uploaded",
        message: `${body.count} image(s) uploaded to study #${study_id}`,
        study_id,
      });
    }

    if (receptionistId && receptionistId !== doctorId) {
      await notifService.createNotification({
        user_id: receptionistId,
        type: "image_uploaded",
        title: "Images Uploaded",
        message: `${body.count} image(s) were uploaded to study #${study_id}`,
        study_id,
      });
    }

    await auditService.log({
      ...actor,
      action: "IMAGE_UPLOAD",
      entity: "Study",
      entity_id: study_id,
      description: `${body.count} image(s) uploaded to study #${study_id}`,
      ip_address: ip,
    });
  },
);

// ---------- Patient Registered ----------
exports.onPatientRegister = notifyAfter(async ({ req, body, actor, ip }) => {
  const doctorId = body.patient?.doctor_id;
  const patientId = body.patient?.national_id;
  const studyId = body.study?.study_id;
  const adminIds = await getUsersByRole("Admin");

  if (doctorId) {
    await notifService.createNotification({
      user_id: doctorId,
      type: "patient_registered",
      title: "New Patient Assigned",
      message: `Patient ${body.patient?.first_name} ${body.patient?.last_name} (${patientId}) assigned to you with study #${studyId}`,
      patient_id: patientId,
      study_id: studyId,
    });
  }

  if (actor.actor_id) {
    await notifService.createNotification({
      user_id: actor.actor_id,
      type: "patient_registered",
      title: "Patient Registered Successfully",
      message: `Patient ${body.patient?.first_name} ${body.patient?.last_name} (${patientId}) has been registered and assigned to Dr. ${body.patient?.doctor_name}`,
      patient_id: patientId,
      study_id: studyId,
    });
  }

  await notifyMany(adminIds, {
    type: "patient_registered",
    title: "New Patient Registered",
    message: `${actor.actor_name} registered patient ${body.patient?.first_name} ${body.patient?.last_name} (${patientId})`,
    patient_id: patientId,
    study_id: studyId,
  });

  await auditService.log({
    ...actor,
    action: "PATIENT_REGISTER",
    entity: "Patient",
    entity_id: patientId,
    description: `Patient registered: ${body.patient?.first_name} ${body.patient?.last_name} — Doctor: ${body.patient?.doctor_name}`,
    ip_address: ip,
  });
});

// ---------- Patient Updated ----------
exports.onPatientUpdate = notifyAfter(
  async ({ req, body, actor, ip, national_id }) => {
    await auditService.log({
      ...actor,
      action: "PATIENT_UPDATE",
      entity: "Patient",
      entity_id: national_id,
      description: `Patient ${national_id} updated. Fields: ${Object.keys(req.body || {}).join(", ")}`,
      ip_address: ip,
    });
  },
);

// ---------- Patient Deactivated ----------
exports.onPatientDelete = notifyAfter(
  async ({ req, body, actor, ip, national_id }) => {
    const adminIds = await getUsersByRole("Admin");

    await notifyMany(adminIds, {
      type: "patient_deactivated",
      title: "Patient Deactivated",
      message: `${actor.actor_name} deactivated patient #${national_id}`,
      patient_id: national_id,
    });

    await auditService.log({
      ...actor,
      action: "PATIENT_DEACTIVATE",
      entity: "Patient",
      entity_id: national_id,
      description: `Patient ${national_id} deactivated (soft delete)`,
      ip_address: ip,
    });
  },
);

// ---------- Patient Status → Completed ----------
exports.onPatientCompleted = notifyAfter(
  async ({ req, body, actor, ip, study_id, national_id }) => {
    const receptionistId = await getReceptionistFromStudy(study_id);

    if (receptionistId) {
      await notifService.createNotification({
        user_id: receptionistId,
        type: "patient_completed",
        title: "Patient Study Completed",
        message: `Study #${study_id} for patient #${national_id} has been marked as completed.`,
        study_id,
        patient_id: national_id,
      });
    }

    await auditService.log({
      ...actor,
      action: "PATIENT_COMPLETED",
      entity: "Patient",
      entity_id: national_id,
      description: `Study #${study_id} marked as completed for patient ${national_id}`,
      ip_address: ip,
    });
  },
);

// ---------- Doctor Reassigned ----------
exports.onDoctorReassign = notifyAfter(
  async ({ req, body, actor, ip, national_id }) => {
    const newDoctorId = req.body?.doctor_id;
    const studyId = body.study?.study_id;
    const adminIds = await getUsersByRole("Admin");
    const receptionistIds = await getUsersByRole("Receptionist");

    if (newDoctorId) {
      await notifService.createNotification({
        user_id: newDoctorId,
        type: "doctor_reassigned",
        title: "Patient Assigned to You",
        message: `Patient ${national_id} has been reassigned to you with a new study #${studyId}`,
        patient_id: national_id,
        study_id: studyId,
      });
    }

    await notifyMany(adminIds, {
      type: "doctor_reassigned",
      title: "Doctor Reassigned",
      message: `${actor.actor_name} reassigned patient #${national_id} to Doctor #${newDoctorId}`,
      patient_id: national_id,
      study_id: studyId,
    });

    await notifyMany(receptionistIds, {
      type: "doctor_reassigned",
      title: "Doctor Reassigned",
      message: `Patient #${national_id} has been reassigned to a new doctor (study #${studyId})`,
      patient_id: national_id,
      study_id: studyId,
    });

    await auditService.log({
      ...actor,
      action: "DOCTOR_REASSIGN",
      entity: "Patient",
      entity_id: national_id,
      description: `Doctor reassigned for patient ${national_id} → Doctor ID: ${newDoctorId}`,
      ip_address: ip,
    });
  },
);

// ---------- User Created ----------
exports.onUserCreate = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");

  await notifyMany(adminIds, {
    type: "user_created",
    title: "New User Created",
    message: `${actor.actor_name} created a new ${req.body?.role_name} account for ${req.body?.email}`,
  });

  await auditService.log({
    ...actor,
    action: "USER_CREATE",
    entity: "User",
    entity_id: null,
    description: `New user created: ${req.body?.email} — Role: ${req.body?.role_name}`,
    ip_address: ip,
  });
});

// ---------- User Deactivated ----------
exports.onUserDeactivate = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");

  await notifyMany(adminIds, {
    type: "user_deactivated",
    title: "User Deactivated",
    message: `${actor.actor_name} deactivated user #${req.params?.id}`,
  });

  await auditService.log({
    ...actor,
    action: "USER_DEACTIVATE",
    entity: "User",
    entity_id: req.params?.id,
    description: `User #${req.params?.id} deactivated`,
    ip_address: ip,
  });
});

// ---------- User Reactivated ----------
exports.onUserReactivate = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");

  await notifyMany(adminIds, {
    type: "user_reactivated",
    title: "User Reactivated",
    message: `${actor.actor_name} reactivated user #${req.params?.id}`,
  });

  await auditService.log({
    ...actor,
    action: "USER_REACTIVATE",
    entity: "User",
    entity_id: req.params?.id,
    description: `User #${req.params?.id} reactivated`,
    ip_address: ip,
  });
});

// ---------- Profile Updated ----------
exports.onProfileUpdate = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");
  const changedFields = Object.keys(req.body || {}).join(", ");

  await notifyMany(adminIds, {
    type: "profile_updated",
    title: "Profile Updated",
    message: `${actor.actor_name} (${actor.actor_role}) updated their profile. Fields: ${changedFields}`,
  });

  await auditService.log({
    ...actor,
    action: "PROFILE_UPDATE",
    entity: "User",
    entity_id: String(actor.actor_id),
    description: `${actor.actor_name} updated profile. Fields: ${changedFields}`,
    ip_address: ip,
  });
});

// ---------- Password Changed ----------
exports.onPasswordChange = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");

  await notifyMany(adminIds, {
    type: "password_changed",
    title: "Password Changed",
    message: `${actor.actor_name} (${actor.actor_role}) changed their password`,
  });

  await auditService.log({
    ...actor,
    action: "PASSWORD_CHANGE",
    entity: "User",
    entity_id: String(actor.actor_id),
    description: `${actor.actor_name} changed their password`,
    ip_address: ip,
  });
});

// ---------- Patients Transferred ----------
exports.onPatientsTransfer = notifyAfter(async ({ req, body, actor, ip }) => {
  const adminIds = await getUsersByRole("Admin");

  await notifyMany(adminIds, {
    type: "patients_transferred",
    title: "Patients Transferred",
    message: `${actor.actor_name} transferred all patients from Doctor #${req.body?.oldDoctor} to Doctor #${req.body?.newDoctor}`,
  });

  await auditService.log({
    ...actor,
    action: "PATIENTS_TRANSFER",
    entity: "User",
    entity_id: req.body?.oldDoctor,
    description: `Patients transferred from Doctor #${req.body?.oldDoctor} → Doctor #${req.body?.newDoctor}`,
    ip_address: ip,
  });
});

// ---------- Failed Login / Suspicious IP ----------
exports.onFailedLogin = async ({ ip_address, email, attempts }) => {
  try {
    const adminIds = await getUsersByRole("Admin");
    const isDangerous = attempts >= 5;

    await notifyMany(adminIds, {
      type: isDangerous ? "suspicious_ip" : "failed_login",
      title: isDangerous ? "⚠️ Suspicious IP Detected" : "Failed Login Attempt",
      message: isDangerous
        ? `Suspicious activity: ${attempts} failed login attempts from IP ${ip_address} for account ${email}`
        : `Failed login attempt for ${email} from IP ${ip_address}`,
    });
  } catch (err) {
    console.error("⚠️ onFailedLogin notify error:", err.message);
  }
};

// ---------- Login ----------
exports.onLogin = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    res._responseBody = body;
    return originalJson(body);
  };

  res.on("finish", async () => {
    try {
      const body = res._responseBody;
      if (!body?.token) return;

      const user = body.user;
      await auditService.log({
        actor_id: user?.id,
        actor_name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        actor_role: user?.role,
        action: "LOGIN",
        entity: "User",
        entity_id: String(user?.id),
        description: `User logged in: ${user?.email}`,
        ip_address: getIP(req),
      });
    } catch (err) {
      console.error("⚠️ onLogin audit error:", err.message);
    }
  });

  next();
};

// ---------- Logout ----------
exports.onLogout = async (req, res, next) => {
  const actor = getActor(req);

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    res._responseBody = body;
    return originalJson(body);
  };

  res.on("finish", async () => {
    try {
      await auditService.log({
        ...actor,
        action: "LOGOUT",
        entity: "User",
        entity_id: String(actor.actor_id),
        description: `User logged out`,
        ip_address: getIP(req),
      });
    } catch (err) {
      console.error("⚠️ onLogout audit error:", err.message);
    }
  });

  next();
};

// ---------- Image Accessed ----------
exports.onImageAccess = async (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 200) {
      auditService.log({
        actor_id: req.user?.id,
        actor_name:
          `${req.user?.first_name || ""} ${req.user?.last_name || ""}`.trim(),
        actor_role: req.user?.role,
        action: "VIEW",
        entity: "Image",
        entity_id: req.params.image_id,
        description: `Image viewed for study ${req.params.study_id}`,
        ip_address: req.ip,
      });
    }
  });
  next();
};
