// Created by farah
const db = require("../../config/db");

// ==========================================
// GET ALL ACTIVE SESSIONS (Admin)
// ==========================================
exports.getActiveSessions = async (filters = {}) => {
  let { keyword, role, page = 1, limit = 20 } = filters;

  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  let where = `
    WHERE u.refresh_token IS NOT NULL
      AND u.refresh_token_expiry > NOW()
      AND u.is_active = 1
  `;
  const params = [];
  const cParams = [];

  if (keyword) {
    where += `
      AND (
        CONCAT(u.first_name, ' ', u.last_name) LIKE ?
        OR u.email LIKE ?
        OR u.username LIKE ?
      )
    `;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    cParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (role) {
    where += ` AND r.role_name = ?`;
    params.push(role);
    cParams.push(role);
  }

  const [rows] = await db.query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.username,
       u.email,
       r.role_name,
       u.refresh_token_expiry AS session_expires_at,
       u.last_login_at,
       u.last_login_ip
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     ${where}
     ORDER BY u.last_login_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     ${where}`,
    cParams,
  );

  return {
    page,
    limit,
    total: countRows[0].total,
    pages: Math.ceil(countRows[0].total / limit),
    data: rows,
  };
};

// ==========================================
// FORCE LOGOUT (Admin terminates a session)
// ==========================================
exports.forceLogout = async (target_user_id, admin_id) => {
  if (String(target_user_id) === String(admin_id)) {
    throw { status: 400, message: "Cannot force logout yourself" };
  }

  const [user] = await db.query(
    `SELECT user_id, refresh_token FROM users WHERE user_id = ?`,
    [target_user_id],
  );

  if (!user.length) {
    throw { status: 404, message: "User not found" };
  }

  if (!user[0].refresh_token) {
    return { message: "User has no active session" };
  }

  await db.query(
    `UPDATE Users
     SET refresh_token = NULL,
         refresh_token_expiry = NULL
     WHERE user_id = ?`,
    [target_user_id],
  );

  return { message: "Session terminated successfully" };
};

// ==========================================
// FORCE LOGOUT ALL (except admin)
// ==========================================
exports.forceLogoutAll = async (admin_id) => {
  const [result] = await db.query(
    `UPDATE Users
     SET refresh_token = NULL,
         refresh_token_expiry = NULL
     WHERE refresh_token IS NOT NULL
       AND user_id != ?`,
    [admin_id],
  );

  return {
    message: `Terminated ${result.affectedRows} active session(s)`,
    terminated: result.affectedRows,
  };
};

// ==========================================
// SESSION STATS
// ==========================================
exports.getSessionStats = async () => {
  const [[active]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Users
     WHERE refresh_token IS NOT NULL
       AND refresh_token_expiry > NOW()
       AND is_active = 1`,
  );

  const [[expired]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE refresh_token IS NOT NULL
       AND refresh_token_expiry <= NOW()`,
  );

  const [byRole] = await db.query(
    `SELECT r.role_name, COUNT(*) AS count
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.refresh_token IS NOT NULL
       AND u.refresh_token_expiry > NOW()
       AND u.is_active = 1
     GROUP BY r.role_name`,
  );

  return {
    active_sessions: active.total,
    expired_sessions: expired.total,
    by_role: byRole,
  };
};
