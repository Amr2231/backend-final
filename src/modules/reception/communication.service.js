const db = require("../../config/db");
const realtime = require("./realtime.service");

exports.logCommunication = async ({
  national_id,
  appointment_id,
  type,
  title,
  content,
  metadata,
  created_by,
}) => {
  const [result] = await db.query(
    `INSERT INTO PatientCommunications
       (national_id, appointment_id, type, title, content, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      national_id,
      appointment_id || null,
      type,
      title,
      content || null,
      metadata ? JSON.stringify(metadata) : null,
      created_by,
    ],
  );
  return { communication_id: result.insertId };
};

exports.getTimeline = async (filters = {}) => {
  const { national_id, type, search, page = 1, limit = 30 } = filters;
  if (!national_id) throw { status: 400, message: "national_id is required" };

  let where = "pc.national_id = ?";
  const params = [national_id];

  if (type) {
    where += " AND pc.type = ?";
    params.push(type);
  }
  if (search?.trim()) {
    where += " AND (pc.title LIKE ? OR pc.content LIKE ?)";
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }

  const lim = Math.min(100, Math.max(1, parseInt(limit) || 30));
  const pg = Math.max(1, parseInt(page) || 1);
  const offset = (pg - 1) * lim;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM PatientCommunications pc WHERE ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT
       pc.*,
       CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM PatientCommunications pc
     JOIN Users u ON pc.created_by = u.user_id
     WHERE ${where}
     ORDER BY pc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );

  const [attempts] = await db.query(
    `SELECT
       ca.*,
       CONCAT(u.first_name, ' ', u.last_name) AS contacted_by_name
     FROM ContactAttempts ca
     JOIN Users u ON ca.contacted_by = u.user_id
     WHERE ca.national_id = ?
     ORDER BY ca.contacted_at DESC`,
    [national_id],
  );

  return {
    page: pg,
    limit: lim,
    total: countRows[0].total,
    communications: rows,
    contact_attempts: attempts,
  };
};

exports.createCallback = async (data, userId) => {
  const { national_id, patient_name, phone_number, reason, notes, priority = "Normal" } = data;
  if (!phone_number || !reason) {
    throw { status: 400, message: "phone_number and reason are required" };
  }

  const [result] = await db.query(
    `INSERT INTO CallbackRequests
       (national_id, patient_name, phone_number, reason, notes, priority, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      national_id || null,
      patient_name || null,
      phone_number,
      reason,
      notes || null,
      priority,
      userId,
    ],
  );

  if (national_id) {
    await exports.logCommunication({
      national_id,
      type: "Callback",
      title: "Callback request created",
      content: reason,
      created_by: userId,
    });
  }

  realtime.emit(realtime.CHANNELS.NOTIFICATIONS, { type: "callback_created" });
  return exports.getCallback(result.insertId);
};

exports.listCallbacks = async (filters = {}) => {
  const { status, priority, search, page = 1, limit = 20 } = filters;
  let where = "1=1";
  const params = [];

  if (status) {
    where += " AND cb.status = ?";
    params.push(status);
  }
  if (priority) {
    where += " AND cb.priority = ?";
    params.push(priority);
  }
  if (search?.trim()) {
    where += " AND (cb.patient_name LIKE ? OR cb.phone_number LIKE ? OR cb.reason LIKE ?)";
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  const lim = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const pg = Math.max(1, parseInt(page) || 1);
  const offset = (pg - 1) * lim;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM CallbackRequests cb WHERE ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT
       cb.*,
       CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
       (SELECT COUNT(*) FROM ContactAttempts ca WHERE ca.callback_id = cb.callback_id) AS attempt_count
     FROM CallbackRequests cb
     JOIN Users u ON cb.created_by = u.user_id
     WHERE ${where}
     ORDER BY
       FIELD(cb.priority, 'High', 'Normal', 'Low'),
       cb.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );

  return { page: pg, limit: lim, total: countRows[0].total, data: rows };
};

exports.getCallback = async (callbackId) => {
  const [rows] = await db.query(
    `SELECT cb.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM CallbackRequests cb
     JOIN Users u ON cb.created_by = u.user_id
     WHERE cb.callback_id = ?`,
    [callbackId],
  );
  if (!rows.length) throw { status: 404, message: "Callback not found" };
  return rows[0];
};

exports.updateCallbackStatus = async (callbackId, status, userId) => {
  await db.query(
    `UPDATE CallbackRequests SET status = ? WHERE callback_id = ?`,
    [status, callbackId],
  );
  const cb = await exports.getCallback(callbackId);
  if (cb.national_id) {
    await exports.logCommunication({
      national_id: cb.national_id,
      type: "Callback",
      title: `Callback ${status}`,
      content: cb.reason,
      created_by: userId,
    });
  }
  return cb;
};

exports.addContactAttempt = async (callbackId, data, userId) => {
  const { outcome, notes } = data;
  if (!outcome) throw { status: 400, message: "outcome is required" };

  const cb = await exports.getCallback(callbackId);

  const [result] = await db.query(
    `INSERT INTO ContactAttempts
       (callback_id, national_id, outcome, notes, contacted_by)
     VALUES (?, ?, ?, ?, ?)`,
    [callbackId, cb.national_id, outcome, notes || null, userId],
  );

  if (outcome === "Answered") {
    await db.query(
      `UPDATE CallbackRequests SET status = 'Contacted' WHERE callback_id = ?`,
      [callbackId],
    );
  }

  if (cb.national_id) {
    await exports.logCommunication({
      national_id: cb.national_id,
      type: "Call",
      title: `Called — ${outcome}`,
      content: notes || `Contact attempt: ${outcome}`,
      metadata: { callback_id: callbackId, attempt_id: result.insertId },
      created_by: userId,
    });
  }

  return {
    attempt_id: result.insertId,
    callback: await exports.getCallback(callbackId),
  };
};

exports.addNote = async (national_id, content, userId, appointment_id) => {
  if (!national_id || !content?.trim()) {
    throw { status: 400, message: "national_id and content are required" };
  }
  return exports.logCommunication({
    national_id,
    appointment_id,
    type: "Note",
    title: "Staff note",
    content: content.trim(),
    created_by: userId,
  });
};
