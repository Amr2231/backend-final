const db = require("../../config/db");
const {
  computePriorityScore,
  priorityReason,
  PRIORITY_BASE_SCORE,
} = require("./constants");
const realtime = require("./realtime.service");

async function getQueueEntryByAppointment(appointmentId) {
  const [rows] = await db.query(
    `SELECT * FROM QueueEntries WHERE appointment_id = ?`,
    [appointmentId],
  );
  return rows[0] || null;
}

async function reorderQueue(connection) {
  const conn = connection || db;
  const [entries] = await conn.query(
    `SELECT q.queue_id, q.appointment_id, q.priority_level, a.check_in_at
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     WHERE q.board_status NOT IN ('Completed')
       AND a.appointment_date = CURDATE()
     ORDER BY q.queue_id`,
  );

  const scored = entries.map((e) => {
    const score = computePriorityScore(e.priority_level, e.check_in_at);
    const minutesWaiting = e.check_in_at
      ? Math.floor((Date.now() - new Date(e.check_in_at).getTime()) / 60000)
      : 0;
    return {
      ...e,
      priority_score: score,
      priority_reason: priorityReason(e.priority_level, minutesWaiting),
    };
  });

  scored.sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    return a.queue_id - b.queue_id;
  });

  for (let i = 0; i < scored.length; i++) {
    const item = scored[i];
    const position = i + 1;
    const estWait = Math.max(0, (position - 1) * 15);
    await conn.query(
      `UPDATE QueueEntries
       SET queue_position = ?, priority_score = ?, priority_reason = ?, estimated_wait_minutes = ?
       WHERE queue_id = ?`,
      [position, item.priority_score, item.priority_reason, estWait, item.queue_id],
    );
  }

  realtime.emit(realtime.CHANNELS.QUEUE, { action: "reordered" });
  realtime.emit(realtime.CHANNELS.ARRIVAL_BOARD, { action: "reordered" });
}

async function ensureQueueEntry(appointmentId, priorityLevel, connection) {
  const conn = connection || db;
  const existing = await getQueueEntryByAppointment(appointmentId);
  if (existing) return existing;

  const [maxPos] = await conn.query(
    `SELECT COALESCE(MAX(queue_position), 0) AS max_pos
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     WHERE a.appointment_date = CURDATE() AND q.board_status NOT IN ('Completed')`,
  );
  const position = (maxPos[0]?.max_pos || 0) + 1;

  const [result] = await conn.query(
    `INSERT INTO QueueEntries
       (appointment_id, queue_position, board_status, priority_level, priority_score, priority_reason)
     VALUES (?, ?, 'Waiting', ?, ?, ?)`,
    [
      appointmentId,
      position,
      priorityLevel,
      PRIORITY_BASE_SCORE[priorityLevel] ?? 0,
      priorityReason(priorityLevel, 0),
    ],
  );

  await reorderQueue(conn);
  return { queue_id: result.insertId, appointment_id: appointmentId };
}

async function logQueueHistory(
  queueId,
  appointmentId,
  action,
  fromPos,
  toPos,
  reason,
  userId,
  connection,
) {
  const conn = connection || db;
  await conn.query(
    `INSERT INTO QueueHistory
       (queue_id, appointment_id, action, from_position, to_position, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [queueId, appointmentId, action, fromPos, toPos, reason, userId],
  );
}

async function updateBoardStatus(appointmentId, boardStatus, userId) {
  const entry = await getQueueEntryByAppointment(appointmentId);
  if (!entry) throw { status: 404, message: "Queue entry not found" };

  const fromPos = entry.queue_position;
  await db.query(
    `UPDATE QueueEntries SET board_status = ?, called_at = IF(? = 'Called', NOW(), called_at) WHERE appointment_id = ?`,
    [boardStatus, boardStatus, appointmentId],
  );

  await logQueueHistory(
    entry.queue_id,
    appointmentId,
    `board_status:${boardStatus}`,
    fromPos,
    fromPos,
    null,
    userId,
  );

  if (boardStatus !== "Completed") await reorderQueue();
  realtime.emit(realtime.CHANNELS.ARRIVAL_BOARD, { appointment_id: appointmentId, boardStatus });
}

async function getQueue(filters = {}) {
  const { status, search, page = 1, limit = 50 } = filters;
  const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const lim = Math.min(100, Math.max(1, limit));

  let where = `a.appointment_date = CURDATE() AND q.board_status != 'Completed'`;
  const params = [];

  if (status) {
    where += ` AND q.board_status = ?`;
    params.push(status);
  }
  if (search?.trim()) {
    where += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.national_id LIKE ?)`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     JOIN patients p ON a.national_id = p.national_id
     WHERE ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT
       q.queue_id,
       q.appointment_id,
       q.queue_position,
       q.board_status,
       q.priority_level,
       q.priority_score,
       q.priority_reason,
       q.estimated_wait_minutes,
       q.called_at,
       q.created_at,
       a.check_in_at,
       a.appointment_time,
       a.status AS appointment_status,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.national_id,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
       u.user_id AS doctor_id,
       TIMESTAMPDIFF(MINUTE, COALESCE(a.check_in_at, q.created_at), NOW()) AS waiting_minutes
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     JOIN patients p ON a.national_id = p.national_id
     JOIN users u ON a.doctor_id = u.user_id
     WHERE ${where}
     ORDER BY q.queue_position ASC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );

  return { page, limit: lim, total: countRows[0].total, data: rows };
}

async function getQueueHistory(appointmentId) {
  const [rows] = await db.query(
    `SELECT h.*, CONCAT(u.first_name, ' ', u.last_name) AS actor_name
     FROM QueueHistory h
     LEFT JOIN users u ON h.created_by = u.user_id
     WHERE h.appointment_id = ?
     ORDER BY h.created_at DESC
     LIMIT 50`,
    [appointmentId],
  );
  return { data: rows };
}

async function getArrivalBoard(filters = {}) {
  const { status, search } = filters;
  let where = `a.appointment_date = CURDATE()`;
  const params = [];

  if (status) {
    where += ` AND q.board_status = ?`;
    params.push(status);
  }
  if (search?.trim()) {
    where += ` AND (p.first_name LIKE ? OR p.last_name LIKE ?)`;
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }

  const [rows] = await db.query(
    `SELECT
       q.queue_id,
       q.appointment_id,
       q.queue_position,
       q.board_status,
       q.priority_level,
       q.estimated_wait_minutes,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.national_id,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
       TIMESTAMPDIFF(MINUTE, COALESCE(a.check_in_at, q.created_at), NOW()) AS waiting_minutes
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     JOIN patients p ON a.national_id = p.national_id
     JOIN users u ON a.doctor_id = u.user_id
     WHERE ${where}
     ORDER BY q.queue_position ASC`,
    params,
  );

  return { data: rows };
}

module.exports = {
  reorderQueue,
  ensureQueueEntry,
  updateBoardStatus,
  getQueue,
  getQueueHistory,
  getArrivalBoard,
  getQueueEntryByAppointment,
  logQueueHistory,
};
