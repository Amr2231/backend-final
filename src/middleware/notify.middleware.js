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
// HELPER — get doctor_id from study
// ==========================================
async function getDoctorFromStudy(study_id) {
  try {
    const [rows] = await db.query(
      `SELECT p.doctor_id FROM Studies s
       JOIN Patients p ON s.national_id = p.national_id
       WHERE s.study_id = ?`,
      [study_id],
    );
    return rows[0]?.doctor_id || null;
  } catch {
    return null;
  }
}

// ==========================================
// NOTIFY + AUDIT AFTER RESPONSE SENT
// ==========================================
function notifyAfter(handler) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      originalJson(body);

      // Only process successful responses
      if (!body?.success) return;

      const actor = getActor(req);
      const ip = getIP(req);
      const study_id = req.params?.study_id || body?.study_id || null;
      const national_id =
        req.params?.national_id || body?.patient?.national_id || null;

      try {
        await handler({ req, body, actor, ip, study_id, national_id });
      } catch (err) {
        console.error("⚠️ notify middleware error:", err.message);
      }
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
    if (doctorId) {
      await notifService.createNotification({
        user_id: doctorId,
        type: "report_signed",
        title: "Report Finalized",
        message: `Report for study #${study_id} has been signed and study marked as completed.`,
        study_id,
      });
    }

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

// ---------- Image Uploaded ----------
exports.onImageUpload = notifyAfter(
  async ({ req, body, actor, ip, study_id }) => {
    const doctorId = await getDoctorFromStudy(study_id);
    if (doctorId) {
      await notifService.createNotification({
        user_id: doctorId,
        type: "image_uploaded",
        title: "Images Uploaded",
        message: `${body.count} image(s) uploaded to study #${study_id}`,
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

  if (doctorId) {
    await notifService.createNotification({
      user_id: doctorId,
      type: "patient_registered",
      title: "New Patient Assigned",
      message: `Patient ${body.patient?.first_name} ${body.patient?.last_name} (${patientId}) assigned to you with study #${body.study?.study_id}`,
      patient_id: patientId,
      study_id: body.study?.study_id,
    });
  }

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

// ---------- Patient Deleted (soft) ----------
exports.onPatientDelete = notifyAfter(
  async ({ req, body, actor, ip, national_id }) => {
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

// ---------- Doctor Reassigned ----------
exports.onDoctorReassign = notifyAfter(
  async ({ req, body, actor, ip, national_id }) => {
    const newDoctorId = req.body?.doctor_id;

    if (newDoctorId) {
      await notifService.createNotification({
        user_id: newDoctorId,
        type: "doctor_reassigned",
        title: "Patient Assigned to You",
        message: `Patient ${national_id} has been reassigned to you with a new study #${body.study?.study_id}`,
        patient_id: national_id,
        study_id: body.study?.study_id,
      });
    }

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
  await auditService.log({
    ...actor,
    action: "USER_REACTIVATE",
    entity: "User",
    entity_id: req.params?.id,
    description: `User #${req.params?.id} reactivated`,
    ip_address: ip,
  });
});

// ---------- Patients Transferred ----------
exports.onPatientsTransfer = notifyAfter(async ({ req, body, actor, ip }) => {
  await auditService.log({
    ...actor,
    action: "PATIENTS_TRANSFER",
    entity: "User",
    entity_id: req.body?.oldDoctor,
    description: `Patients transferred from Doctor #${req.body?.oldDoctor} → Doctor #${req.body?.newDoctor}`,
    ip_address: ip,
  });
});

// ---------- Login ----------
exports.onLogin = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async function (body) {
    originalJson(body);
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
  };
  next();
};

// ---------- Logout ----------
exports.onLogout = async (req, res, next) => {
  const actor = getActor(req);
  const originalJson = res.json.bind(res);
  res.json = async function (body) {
    originalJson(body);
    await auditService.log({
      ...actor,
      action: "LOGOUT",
      entity: "User",
      entity_id: String(actor.actor_id),
      description: `User logged out`,
      ip_address: getIP(req),
    });
  };
  next();
};

// Called when doctor serves an image
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

// Called when doctor exports/views a PDF report
exports.onReportAccess = async (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 200) {
      auditService.log({
        actor_id: req.user?.id,
        actor_name:
          `${req.user?.first_name || ""} ${req.user?.last_name || ""}`.trim(),
        actor_role: req.user?.role,
        action: "EXPORT",
        entity: "Report",
        entity_id: req.params.study_id,
        description: `Report PDF exported for study ${req.params.study_id}`,
        ip_address: req.ip,
      });
    }
  });
  next();
};
