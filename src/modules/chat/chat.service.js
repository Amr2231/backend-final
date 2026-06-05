// ================= INTERNAL CHAT SERVICE (extended) =================
const db = require("../../config/db");
const realtime = require("../reception/realtime.service");

exports.sendMessage = async (sender_id, payload) => {
  const {
    receiver_id,
    message,
    patient_id,
    appointment_id,
    attachment_path,
  } = payload;

  if (!receiver_id) throw { status: 400, message: "receiver_id is required" };
  if (!message || !message.trim())
    throw { status: 400, message: "message is required" };

  const [receiver] = await db.query(
    `SELECT user_id FROM users WHERE user_id = ? AND is_active = 1`,
    [receiver_id],
  );
  if (!receiver.length) throw { status: 404, message: "Receiver not found" };

  const [result] = await db.query(
    `INSERT INTO InternalMessages
       (sender_id, receiver_id, message, patient_id, appointment_id, attachment_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sender_id,
      receiver_id,
      message.trim(),
      patient_id || null,
      appointment_id || null,
      attachment_path || null,
    ],
  );

  realtime.emit(realtime.CHANNELS.CHAT, {
    sender_id,
    receiver_id,
    message_id: result.insertId,
  });

  const notifService = require("../notification/notification.service");
  const [sender] = await db.query(
    `SELECT CONCAT(first_name,' ',last_name) AS name FROM users WHERE user_id = ?`,
    [sender_id],
  );
  await notifService.createNotification({
    user_id: receiver_id,
    type: "chat_message",
    title: "New Message",
    message: `${sender[0]?.name || "Someone"} sent you a message`,
  });

  return { message_id: result.insertId, message: "Message sent" };
};

exports.getConversation = async (user_id, other_id, page = 1, limit = 30, patient_id = null) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 30;
  const offset = (page - 1) * limit;

  let patientFilter = "";
  const params = [user_id, other_id, other_id, user_id];
  if (patient_id) {
    patientFilter = " AND m.patient_id = ?";
    params.push(patient_id);
  }
  params.push(limit, offset);

  const [rows] = await db.query(
    `SELECT
       m.message_id,
       m.message,
       m.is_read,
       m.read_at,
       m.created_at,
       m.sender_id,
       m.patient_id,
       m.appointment_id,
       m.attachment_path,
       CONCAT(u.first_name,' ',u.last_name) AS sender_name,
       CONCAT(p.first_name,' ',p.last_name) AS patient_name
     FROM InternalMessages m
     JOIN users  u ON m.sender_id = u.user_id
     LEFT JOIN patients p ON m.patient_id = p.national_id
     WHERE
       ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
       ${patientFilter}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  await db.query(
    `UPDATE InternalMessages
     SET is_read = 1, read_at = NOW()
     WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
    [other_id, user_id],
  );

  return { page, limit, data: rows.reverse() };
};

exports.getInbox = async (user_id) => {
  const [rows] = await db.query(
    `SELECT
       u.user_id,
       CONCAT(u.first_name,' ',u.last_name) AS name,
       r.role_name,
       latest.message AS last_message,
       latest.created_at,
       latest.patient_id,
       latest.appointment_id,
       unread.cnt AS unread_count,
       COALESCE(up.is_online, 0) AS is_online
     FROM users  u
     JOIN roles r ON u.role_id = r.role_id
     JOIN (
       SELECT
         IF(sender_id = ?, receiver_id, sender_id) AS other_id,
         message,
         created_at,
         patient_id,
         appointment_id,
         ROW_NUMBER() OVER (
           PARTITION BY LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id)
           ORDER BY created_at DESC
         ) rn
       FROM InternalMessages
       WHERE sender_id = ? OR receiver_id = ?
     ) latest ON u.user_id = latest.other_id AND latest.rn = 1
     LEFT JOIN (
       SELECT sender_id, COUNT(*) AS cnt
       FROM InternalMessages
       WHERE receiver_id = ? AND is_read = 0
       GROUP BY sender_id
     ) unread ON unread.sender_id = u.user_id
     LEFT JOIN UserPresence up ON up.user_id = u.user_id
     WHERE u.user_id != ?
     ORDER BY latest.created_at DESC`,
    [user_id, user_id, user_id, user_id, user_id],
  );

  return { data: rows };
};

exports.getPatientContextThreads = async (user_id) => {
  const [rows] = await db.query(
    `SELECT
       m.patient_id,
       CONCAT(p.first_name,' ',p.last_name) AS patient_name,
       m.appointment_id,
       COUNT(*) AS message_count,
       MAX(m.created_at) AS last_message_at,
       SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread_count
     FROM InternalMessages m
     JOIN patients p ON m.patient_id = p.national_id
     WHERE m.patient_id IS NOT NULL
       AND (m.sender_id = ? OR m.receiver_id = ?)
     GROUP BY m.patient_id, m.appointment_id, p.first_name, p.last_name
     ORDER BY last_message_at DESC`,
    [user_id, user_id, user_id],
  );
  return { data: rows };
};

exports.getUnreadCount = async (user_id) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM InternalMessages
     WHERE receiver_id = ? AND is_read = 0`,
    [user_id],
  );
  return { unread: rows[0].total };
};

exports.setTyping = async (user_id, typing_to_user_id) => {
  await db.query(
    `INSERT INTO UserPresence (user_id, is_online, typing_to_user_id, last_seen_at)
     VALUES (?, 1, ?, NOW())
     ON DUPLICATE KEY UPDATE typing_to_user_id = VALUES(typing_to_user_id), last_seen_at = NOW()`,
    [user_id, typing_to_user_id || null],
  );
  realtime.emit(realtime.CHANNELS.CHAT, { type: "typing", user_id, typing_to_user_id });
};

exports.searchUsers = async (user_id, query = "", limit = 20) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const params = [user_id];
  let where = `WHERE u.user_id != ? AND u.is_active = 1`;

  if (query && String(query).trim()) {
    where += ` AND (
      CONCAT(u.first_name,' ',u.last_name) LIKE ?
      OR u.email LIKE ?
      OR u.username LIKE ?
    )`;
    const q = `%${String(query).trim()}%`;
    params.push(q, q, q);
  }

  params.push(safeLimit);

  const [rows] = await db.query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.username,
       u.email,
       r.role_name,
       COALESCE(up.is_online, 0) AS is_online
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN UserPresence up ON up.user_id = u.user_id
     ${where}
     ORDER BY u.first_name, u.last_name
     LIMIT ?`,
    params,
  );

  return { data: rows };
};
