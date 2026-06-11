const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const controller = require("./auth.controller");
const notify = require("../../middleware/notify.middleware");
const verifyToken = require("../../middleware/auth.middleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", notify.onLogin, controller.login);
router.post("/refresh-token", controller.refreshToken);
router.post("/logout", notify.onLogout, controller.logout);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  controller.forgotPassword,
);
router.post("/reset-password", controller.resetPassword);
router.patch(
  "/change-password",
  verifyToken,
  notify.onPasswordChange,
  controller.changePassword,
);

module.exports = router;
