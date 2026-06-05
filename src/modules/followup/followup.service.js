// ================= created by farah =================
const db = require("../../config/db");

// ================= CREATE REMINDER =================
exports.createReminder = async (
  doctor_id,
  national_id,
  days,
  reason,
  priority = "Routine",
) => {
  if (!national_id) throw { status: 400, message: "national_id is required" };
  if (!days || days < 1) throw { status: 400, message: "days must be >= 1" };
  if (!reason) throw { status: 400, message: "reason is required" };

  const [patient] = await db.query(
    `SELECT national_id FROM patients WHERE national_id = ? AND is_active = 1`,
    [national_id],
  );
  if (!patient.length) throw { status: 404, message: "Patient not found" };

  const due_date = new Date();
  due_date.setDate(due_date.getDate() + parseInt(days));

  const [result] = await db.query(
    `INSERT INTO FollowUpReminders
       (doctor_id, national_id, due_date, reason, priority)
     VALUES (?, ?, ?, ?, ?)`,
    [doctor_id, national_id, due_date, reason, priority],
  );

  return {
    message: "Follow-up reminder set",
    reminder_id: result.insertId,
    due_date,
  };
};

// ================= GET MY REMINDERS =================
exports.getMyReminders = async (doctor_id, filter = "all") => {
  const today = new Date().toISOString().split("T")[0];

  let where = `WHERE f.doctor_id = ? AND f.is_done = 0`;
  const params = [doctor_id];

  if (filter === "today") {
    where += ` AND DATE(f.due_date) = ?`;
    params.push(today);
  } else if (filter === "overdue") {
    where += ` AND DATE(f.due_date) < ?`;
    params.push(today);
  } else if (filter === "upcoming") {
    where += ` AND DATE(f.due_date) >= ?`;
    params.push(today);
  }

  const [rows] = await db.query(
    `SELECT
       f.reminder_id,
       f.due_date,
       f.reason,
       f.priority,
       f.is_done,
       f.created_at,
       p.national_id,
       p.first_name,
       p.last_name,
       DATEDIFF(f.due_date, NOW()) AS days_remaining
     FROM FollowUpReminders f
     JOIN patients p ON f.national_id = p.national_id
     ${where}
     ORDER BY f.due_date ASC`,
    params,
  );

  return { count: rows.length, data: rows };
};

// ================= MARK AS DONE =================
exports.markDone = async (doctor_id, reminder_id) => {
  const [row] = await db.query(
    `SELECT reminder_id FROM FollowUpReminders
     WHERE reminder_id = ? AND doctor_id = ?`,
    [reminder_id, doctor_id],
  );
  if (!row.length) throw { status: 404, message: "Reminder not found" };

  await db.query(
    `UPDATE FollowUpReminders SET is_done = 1, done_at = NOW()
     WHERE reminder_id = ?`,
    [reminder_id],
  );

  return { message: "Reminder marked as done" };
};

// ================= DELETE REMINDER =================
exports.deleteReminder = async (doctor_id, reminder_id) => {
  const [row] = await db.query(
    `SELECT reminder_id FROM FollowUpReminders
     WHERE reminder_id = ? AND doctor_id = ?`,
    [reminder_id, doctor_id],
  );
  if (!row.length) throw { status: 404, message: "Reminder not found" };

  await db.query(`DELETE FROM FollowUpReminders WHERE reminder_id = ?`, [
    reminder_id,
  ]);

  return { message: "Reminder deleted" };
};

// ================= UPDATE REMINDER =================
exports.updateReminder = async (
  doctor_id,
  reminder_id,
  days,
  reason,
  priority,
) => {
  const [row] = await db.query(
    `SELECT reminder_id FROM FollowUpReminders
     WHERE reminder_id = ? AND doctor_id = ?`,
    [reminder_id, doctor_id],
  );
  if (!row.length) throw { status: 404, message: "Reminder not found" };

  const due_date = new Date();
  due_date.setDate(due_date.getDate() + parseInt(days));

  await db.query(
    `UPDATE FollowUpReminders
     SET due_date = ?, reason = ?, priority = ?
     WHERE reminder_id = ?`,
    [due_date, reason, priority, reminder_id],
  );

  return { message: "Reminder updated", due_date };
};
