// Created by farah
const db = require("../../config/db");

const MAX_ATTEMPTS = 3; // lock after 3 failed tries
const LOCKOUT_MINS = 15; // lock for 15 minutes

// ==========================================
// CHECK LOCKOUT (called from auth.service before verify password)
// ==========================================
exports.checkLockout = async (email) => {
  const [rows] = await db.query(
    `SELECT user_id, lockout_until, failed_login_attempts
     FROM Users WHERE email = ?`,
    [email],
  );

  if (!rows.length) return; // unknown email — let auth.service handle it

  const user = rows[0];

  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    throw {
      status: 429,
      message: "Too many login attempts. Please try again later.",
    };
  }
};

// ==========================================
// RECORD FAILED LOGIN
// ==========================================
exports.recordFailedLogin = async (email, ip = null) => {
  const [rows] = await db.query(
    `SELECT u.user_id, u.first_name, u.last_name, u.failed_login_attempts, r.role_name
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.email = ?`,
    [email],
  );

  if (!rows.length) return;

  const user = rows[0];
  const actorName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() || email;
  const attempts = (user.failed_login_attempts || 0) + 1;
  const lockout =
    attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINS * 60 * 1000)
      : null;

  await db.query(
    `UPDATE Users
     SET failed_login_attempts = ?,
         lockout_until = ?
     WHERE user_id = ?`,
    [attempts, lockout, user.user_id],
  );

  // Write to AuditLogs
  await db.query(
    `INSERT INTO AuditLogs
       (actor_id, actor_name, actor_role, action, entity, entity_id, description, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.user_id,
      actorName,
      user.role_name || "User",
      "FAILED_LOGIN",
      "User",
      user.user_id,
      `Failed login attempt ${attempts}${lockout ? " — account locked" : ""}`,
      ip,
    ],
  );
};

// ==========================================
// CLEAR FAILED ATTEMPTS ON SUCCESS
// ==========================================
exports.clearFailedAttempts = async (user_id, ip = null) => {
  await db.query(
    `UPDATE Users
     SET failed_login_attempts = 0,
         lockout_until = NULL,
         last_login_at = NOW(),
         last_login_ip = ?
     WHERE user_id = ?`,
    [ip, user_id],
  );
};

// ==========================================
// UNLOCK ACCOUNT (Admin)
// ==========================================
exports.unlockAccount = async (target_user_id) => {
  const [user] = await db.query(
    `SELECT user_id, lockout_until FROM Users WHERE user_id = ?`,
    [target_user_id],
  );

  if (!user.length) throw { status: 404, message: "User not found" };

  await db.query(
    `UPDATE Users
     SET failed_login_attempts = 0,
         lockout_until = NULL
     WHERE user_id = ?`,
    [target_user_id],
  );

  return { message: "Account unlocked successfully" };
};

// ==========================================
// GET SECURITY OVERVIEW (Admin dashboard)
// ==========================================
exports.getSecurityOverview = async () => {
  // Locked accounts right now
  const [[locked]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Users
     WHERE lockout_until > NOW()`,
  );

  // Users with failed attempts > 0
  const [[atRisk]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Users
     WHERE failed_login_attempts > 0
       AND (lockout_until IS NULL OR lockout_until <= NOW())`,
  );

  // Failed logins last 24h
  const [[recentFails]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM AuditLogs
     WHERE action = 'FAILED_LOGIN'
       AND created_at >= NOW() - INTERVAL 24 HOUR`,
  );

  // Failed logins last 7 days by day
  const [failsByDay] = await db.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM AuditLogs
     WHERE action = 'FAILED_LOGIN'
       AND created_at >= NOW() - INTERVAL 7 DAY
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
  );

  // Top IPs with failures
  const [topIPs] = await db.query(
    `SELECT ip_address, COUNT(*) AS attempts
     FROM AuditLogs
     WHERE action = 'FAILED_LOGIN'
       AND ip_address IS NOT NULL
       AND created_at >= NOW() - INTERVAL 24 HOUR
     GROUP BY ip_address
     ORDER BY attempts DESC
     LIMIT 10`,
  );

  return {
    locked_accounts: locked.total,
    at_risk_accounts: atRisk.total,
    failed_logins_24h: recentFails.total,
    failed_logins_by_day: failsByDay,
    top_suspicious_ips: topIPs,
  };
};

// ==========================================
// GET LOCKED ACCOUNTS LIST (Admin)
// ==========================================
exports.getLockedAccounts = async () => {
  const [rows] = await db.query(
    `SELECT
       u.user_id,
       u.first_name,
       u.last_name,
       u.email,
       r.role_name,
       u.failed_login_attempts,
       u.lockout_until,
       u.last_login_ip
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.lockout_until > NOW()
     ORDER BY u.lockout_until DESC`,
  );

  return { total: rows.length, data: rows };
};

// ==========================================
// GET FAILED LOGIN LOGS (Admin)
// ==========================================
exports.getFailedLoginLogs = async (filters = {}) => {
  let { page = 1, limit = 20, from_date, to_date, ip } = filters;

  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  let where = `WHERE action = 'FAILED_LOGIN'`;
  const params = [];
  const cParams = [];

  if (from_date) {
    where += ` AND DATE(created_at) >= ?`;
    params.push(from_date);
    cParams.push(from_date);
  }

  if (to_date) {
    where += ` AND DATE(created_at) <= ?`;
    params.push(to_date);
    cParams.push(to_date);
  }

  if (ip) {
    where += ` AND ip_address = ?`;
    params.push(ip);
    cParams.push(ip);
  }

  const [rows] = await db.query(
    `SELECT * FROM AuditLogs
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM AuditLogs ${where}`,
    cParams,
  );

  return {
    page,
    limit,
    total: count.total,
    pages: Math.ceil(count.total / limit),
    data: rows,
  };
};
