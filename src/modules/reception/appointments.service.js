const db = require("../../config/db");
const {
  APPOINTMENT_STATUSES,
  VALID_STATUS_TRANSITIONS,
} = require("./constants");
const schedulingService = require("./scheduling.service");
const queueService = require("./queue.service");
const availabilityService = require("./availability.service");
const communicationService = require("./communication.service");
const realtime = require("./realtime.service");
const notifService = require("../notification/notification.service");

const APPT_SELECT = `
  a.appointment_id,
  a.national_id,
  a.doctor_id,
  a.appointment_date,
  a.appointment_time,
  a.duration_minutes,
  a.status,
  a.priority_level,
  a.check_in_at,
  a.consultation_started_at,
  a.completed_at,
  a.notes,
  a.reason,
  a.created_at,
  a.updated_at,
  CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
  p.phone_number,
  p.gender,
  CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
  q.queue_id,
  q.queue_position,
  q.board_status,
  q.priority_score,
  q.priority_reason,
  q.estimated_wait_minutes
`;

const APPT_JOINS = `
  FROM appointments a
  JOIN patients p ON a.national_id = p.national_id
  JOIN users u ON a.doctor_id = u.user_id
  LEFT JOIN queueentries q ON q.appointment_id = a.appointment_id
`;

function buildListQuery(filters) {
  const {
    date,
    status,
    doctor_id,
    priority,
    search,
    sort = "time",
    order = "asc",
    page = 1,
    limit = 20,
  } = filters;

  let where = "1=1";
  const params = [];

  if (date) {
    where += " AND a.appointment_date = ?";
    params.push(date);
  }
  if (status) {
    where += " AND a.status = ?";
    params.push(status);
  }
  if (doctor_id) {
    where += " AND a.doctor_id = ?";
    params.push(doctor_id);
  }
  if (priority) {
    where += " AND a.priority_level = ?";
    params.push(priority);
  }
  if (search?.trim()) {
    where += ` AND (
      p.first_name LIKE ? OR p.last_name LIKE ? OR
      p.national_id LIKE ? OR CONCAT(p.first_name,' ',p.last_name) LIKE ?
    )`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q);
  }

  const sortMap = {
    time: "a.appointment_time",
    patient: "patient_name",
    doctor: "doctor_name",
    status: "a.status",
    priority: "a.priority_level",
    queue: "q.queue_position",
  };
  const sortCol = sortMap[sort] || "a.appointment_time";
  const sortDir = order === "desc" ? "DESC" : "ASC";

  const lim = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const pg = Math.max(1, parseInt(page) || 1);
  const offset = (pg - 1) * lim;

  return { where, params, sortCol, sortDir, lim, pg, offset };
}

exports.listAppointments = async (filters = {}) => {
  const { where, params, sortCol, sortDir, lim, pg, offset } =
    buildListQuery(filters);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total ${APPT_JOINS} WHERE ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT ${APPT_SELECT} ${APPT_JOINS}
     WHERE ${where}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );

  return { page: pg, limit: lim, total: countRows[0].total, data: rows };
};

exports.getTodayAppointments = async (filters = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  return exports.listAppointments({ ...filters, date: today });
};

exports.getAppointment = async (appointmentId) => {
  const [rows] = await db.query(
    `SELECT ${APPT_SELECT} ${APPT_JOINS} WHERE a.appointment_id = ?`,
    [appointmentId],
  );
  if (!rows.length) throw { status: 404, message: "Appointment not found" };
  return rows[0];
};

exports.createAppointment = async (data, userId) => {
  const {
    national_id,
    doctor_id,
    appointment_date,
    appointment_time,
    duration_minutes = 30,
    priority_level = "Normal",
    reason,
    notes,
  } = data;

  if (!national_id || !doctor_id || !appointment_date || !appointment_time) {
    throw { status: 400, message: "Missing required appointment fields" };
  }

  const [patient] = await db.query(
    `SELECT national_id FROM patients WHERE national_id = ? AND is_active = 1`,
    [national_id],
  );
  if (!patient.length) throw { status: 404, message: "Patient not found" };

  const [doctor] = await db.query(
    `SELECT u.user_id FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ? AND r.role_name = 'Doctor' AND u.is_active = 1`,
    [doctor_id],
  );
  if (!doctor.length) throw { status: 404, message: "Doctor not found" };

  const [conflicts] = await db.query(
    `SELECT appointment_id FROM appointments
     WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
       AND status NOT IN ('Cancelled', 'No Show', 'Completed')`,
    [doctor_id, appointment_date, appointment_time],
  );
  if (conflicts.length) {
    throw { status: 409, message: "Doctor already has an appointment at this time" };
  }

  const slotCheck = await schedulingService.suggestSlots({
    doctor_id,
    national_id,
    date: appointment_date,
    duration_minutes,
  });

  if (slotCheck.warnings?.some((w) => w.type === "holiday")) {
    throw { status: 400, message: "Doctor is on leave for this date" };
  }

  if (slotCheck.warnings?.some((w) => w.type === "no_schedule")) {
    throw { status: 400, message: "Doctor is not available on this day" };
  }

  const requestedTime = String(appointment_time).slice(0, 8);
  const isValidSlot = slotCheck.suggestions.some(
    (s) => String(s.appointment_time).slice(0, 8) === requestedTime,
  );

  if (!isValidSlot) {
    throw {
      status: 400,
      message:
        "Selected time is outside doctor availability or conflicts with existing appointments",
    };
  }

  const [result] = await db.query(
    `INSERT INTO appointments
       (national_id, doctor_id, appointment_date, appointment_time, duration_minutes,
        priority_level, reason, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      national_id,
      doctor_id,
      appointment_date,
      appointment_time,
      duration_minutes,
      priority_level,
      reason || null,
      notes || null,
      userId,
    ],
  );

  const appointmentId = result.insertId;

  await notifService.createNotification({
    user_id: doctor_id,
    type: "appointment_created",
    title: "New Appointment Scheduled",
    message: `Patient ${national_id} scheduled on ${appointment_date} at ${String(appointment_time).slice(0, 5)}`,
    patient_id: national_id,
  });

  realtime.emit(realtime.CHANNELS.APPOINTMENTS, { action: "created", appointmentId });
  realtime.emit(realtime.CHANNELS.DASHBOARD, { action: "refresh" });

  return exports.getAppointment(appointmentId);
};

exports.updateStatus = async (appointmentId, newStatus, userId) => {
  if (!APPOINTMENT_STATUSES.includes(newStatus)) {
    throw { status: 400, message: "Invalid status" };
  }

  const appt = await exports.getAppointment(appointmentId);
  const allowed = VALID_STATUS_TRANSITIONS[appt.status] || [];
  if (!allowed.includes(newStatus) && appt.status !== newStatus) {
    throw {
      status: 400,
      message: `Cannot transition from ${appt.status} to ${newStatus}`,
    };
  }

  const updates = { status: newStatus };
  let boardStatus = null;

  if (newStatus === "Checked In") {
    updates.check_in_at = new Date();
    boardStatus = "Checked In";
    await queueService.ensureQueueEntry(appointmentId, appt.priority_level);
  } else if (newStatus === "Waiting") {
    boardStatus = "Waiting";
    await queueService.ensureQueueEntry(appointmentId, appt.priority_level);
  } else if (newStatus === "In Consultation") {
    updates.consultation_started_at = new Date();
    boardStatus = "In Consultation";
    await availabilityService.setDoctorStatus(appt.doctor_id, "In Consultation", appointmentId);
  } else if (newStatus === "Completed") {
    updates.completed_at = new Date();
    boardStatus = "Completed";
    await availabilityService.decrementWorkload(appt.doctor_id);
    await availabilityService.setDoctorStatus(appt.doctor_id, "Available", null);
  } else if (newStatus === "Cancelled" || newStatus === "No Show") {
    await db.query(
      `UPDATE queueentries SET board_status = 'Completed' WHERE appointment_id = ?`,
      [appointmentId],
    );
  }

  await db.query(
    `UPDATE appointments SET
       status = ?,
       check_in_at = COALESCE(?, check_in_at),
       consultation_started_at = COALESCE(?, consultation_started_at),
       completed_at = COALESCE(?, completed_at)
     WHERE appointment_id = ?`,
    [
      newStatus,
      updates.check_in_at || null,
      updates.consultation_started_at || null,
      updates.completed_at || null,
      appointmentId,
    ],
  );

  if (boardStatus) {
    const entry = await queueService.getQueueEntryByAppointment(appointmentId);
    if (entry) {
      await queueService.updateBoardStatus(appointmentId, boardStatus, userId);
    }
  }

  await communicationService.logCommunication({
    national_id: appt.national_id,
    appointment_id: appointmentId,
    type: "Status Change",
    title: `Status updated to ${newStatus}`,
    content: `Appointment status changed from ${appt.status} to ${newStatus}`,
    created_by: userId,
  });

  const [doctorRow] = await db.query(
    `SELECT doctor_id FROM appointments WHERE appointment_id = ?`,
    [appointmentId],
  );
  if (doctorRow[0]?.doctor_id) {
    const notifType =
      newStatus === "Cancelled"
        ? "appointment_cancelled"
        : newStatus === "Scheduled" && appt.status !== "Scheduled"
          ? "appointment_approved"
          : "appointment_status";

    await notifService.createNotification({
      user_id: doctorRow[0].doctor_id,
      type: notifType,
      title:
        newStatus === "Cancelled"
          ? "Appointment Cancelled"
          : "Appointment Update",
      message: `${appt.patient_name} — ${newStatus}`,
      patient_id: appt.national_id,
    });
  }

  realtime.emit(realtime.CHANNELS.APPOINTMENTS, { action: "status", appointmentId, newStatus });
  realtime.emit(realtime.CHANNELS.DASHBOARD, { action: "refresh" });

  return exports.getAppointment(appointmentId);
};

exports.updatePriority = async (appointmentId, priorityLevel, userId) => {
  const appt = await exports.getAppointment(appointmentId);
  await db.query(
    `UPDATE appointments SET priority_level = ? WHERE appointment_id = ?`,
    [priorityLevel, appointmentId],
  );
  await db.query(
    `UPDATE queueentries SET priority_level = ? WHERE appointment_id = ?`,
    [priorityLevel, appointmentId],
  );
  await queueService.reorderQueue();

  const entry = await queueService.getQueueEntryByAppointment(appointmentId);
  if (entry) {
    await queueService.logQueueHistory(
      entry.queue_id,
      appointmentId,
      "priority_change",
      entry.queue_position,
      entry.queue_position,
      `Priority set to ${priorityLevel}`,
      userId,
    );
  }

  realtime.emit(realtime.CHANNELS.QUEUE, { action: "priority", appointmentId });
  return exports.getAppointment(appointmentId);
};

exports.getTimeline = async (appointmentId) => {
  const appt = await exports.getAppointment(appointmentId);
  const events = [];

  events.push({
    type: "scheduled",
    title: "Appointment Scheduled",
    at: appt.created_at,
    detail: `${appt.appointment_time} with ${appt.doctor_name}`,
  });

  if (appt.check_in_at) {
    events.push({
      type: "check_in",
      title: "Patient Checked In",
      at: appt.check_in_at,
    });
  }
  if (appt.consultation_started_at) {
    events.push({
      type: "consultation",
      title: "Consultation Started",
      at: appt.consultation_started_at,
    });
  }
  if (appt.completed_at) {
    events.push({
      type: "completed",
      title: "Appointment Completed",
      at: appt.completed_at,
    });
  }

  const history = await queueService.getQueueHistory(appointmentId);
  for (const h of history.data) {
    events.push({
      type: "queue",
      title: h.action,
      at: h.created_at,
      detail: h.reason,
      actor: h.actor_name,
    });
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { appointment: appt, timeline: events };
};
