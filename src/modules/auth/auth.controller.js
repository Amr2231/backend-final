const service = require("./auth.service");
const { getClientIp } = require("../../utils/ip");

// LOGIN
exports.login = async (req, res, next) => {
  console.log("LOGIN CONTROLLER HIT");
  try {
    const data = await service.login(
      req.body.email,
      req.body.password,
      getClientIp(req),
    ); // The refresh token is in an httpOnly cookie (not accessible from JS) and secure (HTTPS) [added by farah]
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
    res.json({
      message: data.message,
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
    }); // farah edit by add user data in response for better frontend handling
  } catch (err) {
    next(err);
  }
};

// ================= REFRESH TOKEN [created by farah] =================
exports.refreshToken = async (req, res, next) => {
  try {
    // The refresh token is coming from the cookie or the request body (for flexibility, but cookie is preferred for security)
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    const data = await service.refreshToken(token);

    // Update the cookie with the new refresh token
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken, // farah edit by add refresh token in response for better frontend handling (optional, since it's also in the cookie)
    });
  } catch (err) {
    next(err);
  }
};

// ================= LOGOUT =================
exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    await service.logout(token);

    // Delete the cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

// Forgot

exports.forgotPassword = async (req, res) => {
  try {
    const result = await service.forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// RESET
exports.resetPassword = async (req, res, next) => {
  try {
    const result = await service.resetPassword(
      req.body.token,
      req.body.password,
      req.body.confirmPassword,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

//  CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const user_id = req.user.id; // from JWT middleware

    const { current_password, new_password, confirm_new_password } = req.body;

    const result = await service.changePassword(
      user_id,
      current_password,
      new_password,
      confirm_new_password,
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.error || "server_error",
      message: err.message || "Internal Server Error",
      field: err.field || null,
      // next(err); // if you want to pass it to a global error handler instead of sending response here [commented out by farah]
    });
  }
};
