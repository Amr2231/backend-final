const db = require("../../config/db");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const securityService = require("../security/security.service");
const rateLimitService = require("../security/login-rate-limit.service");
require("dotenv").config();
const { sendResetEmail } = require("../../utils/email");

const INVALID_CREDENTIALS = "Invalid email or password";
const LOCKOUT_MESSAGE = "Too many login attempts. Please try again later.";

// ================= LOGIN =================
exports.login = async (email, password, ip = null) => {
  console.log("LOGIN ATTEMPT");
  console.log("EMAIL:", email);
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  // rateLimitService.checkSourceLockout(ip, normalizedEmail);

  if (!email || !password) {
    throw { status: 401, message: INVALID_CREDENTIALS };
  }

  if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
    throw { status: 401, message: INVALID_CREDENTIALS };
  }

  try {
    // await securityService.checkLockout(normalizedEmail);
  } catch (err) {
    throw { status: 429, message: LOCKOUT_MESSAGE };
  }

  const [rows] = await db.query(
    `SELECT u.*, r.role_name
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.email = ?`,
    [normalizedEmail],
  );

  if (!rows.length) {
    rateLimitService.recordFailedAttempt(ip, normalizedEmail);
    throw { status: 401, message: INVALID_CREDENTIALS };
  }

  const user = rows[0];

  if (!user.is_active) {
    rateLimitService.recordFailedAttempt(ip, normalizedEmail);
    throw { status: 401, message: INVALID_CREDENTIALS };
  }

  const valid = await argon2.verify(user.password_hash, password);

  if (!valid) {
    await securityService.recordFailedLogin(normalizedEmail, ip);
    rateLimitService.recordFailedAttempt(ip, normalizedEmail);
    throw { status: 401, message: INVALID_CREDENTIALS };
  }

  const token = jwt.sign(
    { id: user.user_id, role: user.role_name },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  await db.query(
    `UPDATE Users
     SET refresh_token = ?,
         refresh_token_expiry = DATE_ADD(NOW(), INTERVAL 7 DAY)
     WHERE user_id = ?`,
    [refreshToken, user.user_id],
  );

  await securityService.clearFailedAttempts(user.user_id, ip);
  rateLimitService.clearSourceAttempts(ip, normalizedEmail);

  return {
    message: "Login successful",
    token,
    refreshToken,
    user: {
      id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role_name,
      created_at: user.created_at,
      account_status: user.is_active ? "Active" : "Inactive",
    },
  };
};

// ================= REFRESH TOKEN =================
exports.refreshToken = async (refreshToken) => {
  if (!refreshToken)
    throw { status: 401, message: "Invalid email or password" };

  const [rows] = await db.query(
    `SELECT user_id, refresh_token_expiry, is_active
     FROM Users
     WHERE refresh_token = ?`,
    [refreshToken],
  );

  if (!rows.length) throw { status: 403, message: "Invalid email or password" };

  const user = rows[0];

  if (new Date(user.refresh_token_expiry) < new Date())
    throw { status: 403, message: "Invalid email or password" };

  if (!user.is_active)
    throw { status: 403, message: "Invalid email or password" };

  const [userRows] = await db.query(
    `SELECT u.user_id, r.role_name
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.user_id = ?`,
    [user.user_id],
  );

  const newAccessToken = jwt.sign(
    { id: userRows[0].user_id, role: userRows[0].role_name },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const newRefreshToken = crypto.randomBytes(64).toString("hex");

  await db.query(
    `UPDATE Users
     SET refresh_token = ?,
         refresh_token_expiry = DATE_ADD(NOW(), INTERVAL 7 DAY)
     WHERE user_id = ?`,
    [newRefreshToken, user.user_id],
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ================= LOGOUT =================
exports.logout = async (refreshToken) => {
  if (!refreshToken) return { message: "Logged out" };

  await db.query(
    `UPDATE Users
     SET refresh_token = NULL,
         refresh_token_expiry = NULL
     WHERE refresh_token = ?`,
    [refreshToken],
  );

  return { message: "Logged out successfully" };
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const [rows] = await db.query("SELECT user_id FROM Users WHERE email = ?", [
    normalizedEmail,
  ]);

  if (!rows.length) {
    return {
      message: "If this email exists, a reset link has been sent.",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");

  await db.query(
    `UPDATE Users
     SET password_reset_token = ?, 
         reset_token_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
     WHERE email = ?`,
    [token, normalizedEmail],
  );

  const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
  await sendResetEmail(normalizedEmail, resetLink);

  return {
    message: "If this email exists, a reset link has been sent.",
  };
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (token, password, confirmPassword) => {
  if (!password || !confirmPassword) {
    throw { status: 400, error: "missing_fields" , message: "All fields are required" }; // error added by farah 
  }

  if (password !== confirmPassword) {
    throw { status: 400, error: "password_mismatch" , message: "Passwords do not match" }; // error added by farah
  }

  if (password.length < 6) {
    throw { status: 400, error: "weak_password" , message: "Password must be at least 6 characters" }; // error added by farah
  }

  const [rows] = await db.query(
    `SELECT user_id
     FROM Users
     WHERE password_reset_token = ?
       AND reset_token_expiry > NOW()`,
    [token],
  );

  if (!rows.length) {
    throw { status: 400, error: "invalid_token" , message: "Invalid or expired token" }; // error added by farah
  }

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  await db.query(
    `UPDATE Users
     SET password_hash = ?, 
         password_reset_token = NULL, 
         reset_token_expiry = NULL
     WHERE user_id = ?`,
    [hashedPassword, rows[0].user_id],
  );

  return { success: true, message: "Password reset successful" }; // success message added by farah
};

// ================= CHANGE PASSWORD =================
exports.changePassword = async (
  user_id,
  current_password,
  new_password,
  confirm_new_password,
) => {
  if (!current_password || !new_password || !confirm_new_password) {
    throw {
      status: 400,
      error: "bad_request",
      message: "All password fields are required.",
    };
  }

  if (new_password !== confirm_new_password) {
    throw {
      status: 422,
      error: "validation_failed",
      message: "New password and confirmation do not match.",
      field: "confirm_new_password",
    };
  }

  if (current_password === new_password) {
    throw {
      status: 422,
      error: "validation_failed",
      message: "New password must be different from current password.",
      field: "new_password",
    };
  }

  const strongPassword =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/;

  if (!strongPassword.test(new_password)) {
    throw {
      status: 422,
      error: "validation_failed",
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      field: "new_password",
    };
  }

  const [rows] = await db.query(
    `SELECT user_id, password_hash
     FROM Users
     WHERE user_id = ?`,
    [user_id],
  );

  if (!rows.length) {
    throw {
      status: 401,
      error: "invalid_credentials",
      message: INVALID_CREDENTIALS,
    };
  }

  const user = rows[0];
  const valid = await argon2.verify(user.password_hash, current_password);

  if (!valid) {
    throw {
      status: 401,
      error: "invalid_credentials",
      message: INVALID_CREDENTIALS,
    };
  }

  const newHash = await argon2.hash(new_password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  await db.query(
    `UPDATE Users
     SET password_hash = ?
     WHERE user_id = ?`,
    [newHash, user_id],
  );

  return {
    success: true,  // success field added by farah
    message: "Password updated successfully.",
  };
};
