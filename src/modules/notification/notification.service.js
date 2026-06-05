// Created by farah
const db = require("../../config/db");
const realtime = require("../reception/realtime.service");

// ==========================================
// CREATE NOTIFICATION
// ==========================================
exports.createNotification = async ({
  user_id,
  type,
  title,
  message,
  study_id = null,
  patient_id = null,
}) => {
  try {
    await db.query(
      `INSERT INTO Notifications
        (user_id, type, title, message, study_id, patient_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, type, title, message, study_id, patient_id],
    );
    realtime.emit(realtime.CHANNELS.NOTIFICATIONS, {
      user_id,
      type,
      title,
    });
  } catch (err) {
    // Notifications are non-critical — never crash the main flow
    console.error("⚠️ Notification insert failed:", err.message);
  }
};

// ==========================================
// GET USER NOTIFICATIONS
// ==========================================
exports.getUserNotifications = async (user_id, page = 1, limit = 20) => {
  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT *
     FROM Notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [user_id, limit, offset],
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM Notifications WHERE user_id = ?`,
    [user_id],
  );

  const [unreadRows] = await db.query(
    `SELECT COUNT(*) AS unread FROM Notifications WHERE user_id = ? AND is_read = 0`,
    [user_id],
  );

  return {
    page,
    limit,
    total: countRows[0].total,
    unread: unreadRows[0].unread,
    pages: Math.ceil(countRows[0].total / limit),
    data: rows,
  };
};

// ==========================================
// MARK ONE AS READ
// ==========================================
exports.markAsRead = async (notification_id, user_id) => {
  const [rows] = await db.query(
    `SELECT notification_id FROM Notifications
     WHERE notification_id = ? AND user_id = ?`,
    [notification_id, user_id],
  );

  if (!rows.length) throw { status: 404, message: "Notification not found" };

  await db.query(
    `UPDATE Notifications SET is_read = 1 WHERE notification_id = ?`,
    [notification_id],
  );

  return { message: "Marked as read" };
};

// ==========================================
// MARK ALL AS READ
// ==========================================
exports.markAllAsRead = async (user_id) => {
  await db.query(
    `UPDATE Notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
    [user_id],
  );

  return { message: "All notifications marked as read" };
};

// ==========================================
// DELETE ONE NOTIFICATION
// ==========================================
exports.deleteNotification = async (notification_id, user_id) => {
  const [rows] = await db.query(
    `SELECT notification_id FROM Notifications
     WHERE notification_id = ? AND user_id = ?`,
    [notification_id, user_id],
  );

  if (!rows.length) throw { status: 404, message: "Notification not found" };

  await db.query(`DELETE FROM Notifications WHERE notification_id = ?`, [
    notification_id,
  ]);

  return { message: "Notification deleted" };
};
