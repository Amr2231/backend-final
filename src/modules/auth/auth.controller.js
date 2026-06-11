const service = require("./auth.service");
const { getClientIp } = require("../../utils/ip");
const { onFailedLogin } = require("../../middleware/notify.middleware");

// ================= LOGIN =================
exports.login = async (req, res, next) => {
  try {
    const data = await service.login(
      req.body.email,
      req.body.password,
      getClientIp(req),
    );

    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: data.message,
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
    });
  } catch (err) {
    if (err.status === 401) {
      await onFailedLogin({
        ip_address: getClientIp(req),
        email: req.body?.email,
        attempts: 1,
      }).catch(() => {});
    }
    next(err);
  }
};

// ================= REFRESH TOKEN =================
exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const data = await service.refreshToken(token);

    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
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

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const result = await service.forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= RESET PASSWORD =================
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

// ================= CHANGE PASSWORD =================
exports.changePassword = async (req, res) => {
  try {
    const user_id = req.user.id;
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
    });
  }
};
