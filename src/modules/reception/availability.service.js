const db = require("../../config/db");
const realtime = require("./realtime.service");
const { DOCTOR_STATUSES } = require("./constants");

exports.getAllDoctorsAvailability = async () => {
  const [rows] = await db.query(
    `SELECT
       u.user_id AS doctor_id,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
       COALESCE(da.status, 'Available') AS status,
       da.break_until,
       da.workload_count,
       da.current_appointment_id,
       da.updated_at,
       (
         SELECT COUNT(*) FROM appointments a
         WHERE a.doctor_id = u.user_id AND a.appointment_date = CURDATE()
           AND a.status NOT IN ('Cancelled', 'No Show', 'Completed')
       ) AS today_appointments,
       (
         SELECT CONCAT(a.appointment_date, ' ', a.appointment_time)
         FROM appointments a
         WHERE a.doctor_id = u.user_id
           AND CONCAT(a.appointment_date, ' ', a.appointment_time) > NOW()
           AND a.status = 'Scheduled'
         ORDER BY a.appointment_date, a.appointment_time
         LIMIT 1
       ) AS next_available_slot
     FROM users u
     JOIN roles r ON u.role_id = r.role_id AND r.role_name = 'Doctor'
     LEFT JOIN doctoravailability da ON da.doctor_id = u.user_id
     WHERE u.is_active = 1
     ORDER BY doctor_name`,
  );
  return { data: rows };
};

exports.getDoctorAvailability = async (doctorId) => {
  const [rows] = await db.query(
    `SELECT
       u.user_id AS doctor_id,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
       COALESCE(da.status, 'Available') AS status,
       da.break_until,
       da.workload_count,
       da.current_appointment_id,
       da.updated_at
     FROM users u
     LEFT JOIN doctoravailability da ON da.doctor_id = u.user_id
     WHERE u.user_id = ?`,
    [doctorId],
  );
  if (!rows.length) throw { status: 404, message: "Doctor not found" };
  return rows[0];
};

exports.setDoctorStatus = async (doctorId, status, appointmentId = null) => {
  if (!DOCTOR_STATUSES.includes(status)) {
    throw { status: 400, message: "Invalid doctor status" };
  }

  await db.query(
    `INSERT INTO doctoravailability (doctor_id, status, current_appointment_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       current_appointment_id = VALUES(current_appointment_id),
       updated_at = CURRENT_TIMESTAMP`,
    [doctorId, status, appointmentId],
  );

  if (status === "In Consultation") {
    await db.query(
      `UPDATE doctoravailability SET workload_count = workload_count + 1 WHERE doctor_id = ?`,
      [doctorId],
    );
  }

  realtime.emit(realtime.CHANNELS.AVAILABILITY, { doctor_id: doctorId, status });
  return exports.getDoctorAvailability(doctorId);
};

exports.decrementWorkload = async (doctorId) => {
  await db.query(
    `UPDATE doctoravailability
     SET workload_count = GREATEST(0, workload_count - 1)
     WHERE doctor_id = ?`,
    [doctorId],
  );
};

exports.updateDoctorStatus = async (doctorId, status, breakUntil, userId) => {
  if (!DOCTOR_STATUSES.includes(status)) {
    throw { status: 400, message: "Invalid status" };
  }

  await db.query(
    `INSERT INTO doctoravailability (doctor_id, status, break_until)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       break_until = VALUES(break_until),
       updated_at = CURRENT_TIMESTAMP`,
    [doctorId, status, breakUntil || null],
  );

  realtime.emit(realtime.CHANNELS.AVAILABILITY, { doctor_id: doctorId, status });

  const notifService = require("../notification/notification.service");
  if (status === "On Leave" || status === "Break") {
    const [receptionists] = await db.query(
      `SELECT u.user_id FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'Receptionist' AND u.is_active = 1`,
    );
    const doc = await exports.getDoctorAvailability(doctorId);
    for (const r of receptionists) {
      await notifService.createNotification({
        user_id: r.user_id,
        type: "doctor_unavailable",
        title: "Doctor Unavailable",
        message: `Dr. ${doc.doctor_name} is now ${status}`,
      });
    }
  }

  return exports.getDoctorAvailability(doctorId);
};

exports.updatePresence = async (userId, isOnline, typingToUserId = null) => {
  await db.query(
    `INSERT INTO userpresence (user_id, is_online, last_seen_at, typing_to_user_id)
     VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       is_online = VALUES(is_online),
       last_seen_at = NOW(),
       typing_to_user_id = VALUES(typing_to_user_id)`,
    [userId, isOnline ? 1 : 0, typingToUserId],
  );
};

exports.getPresence = async (userIds) => {
  if (!userIds?.length) return { data: [] };
  const placeholders = userIds.map(() => "?").join(",");
  const [rows] = await db.query(
    `SELECT user_id, is_online, last_seen_at, typing_to_user_id
     FROM userpresence WHERE user_id IN (${placeholders})`,
    userIds,
  );
  return { data: rows };
};
