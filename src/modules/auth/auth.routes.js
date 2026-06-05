const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const controller = require("./auth.controller");
const notify = require("../../middleware/notify.middleware");
// JWT middleware
const verifyToken = require("../../middleware/auth.middleware");

// Login rate limiter added by farah
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

router.post("/login", controller.login); // added by farah
router.post("/refresh-token", controller.refreshToken); //added by farah
router.post("/logout", notify.onLogout, controller.logout); // added by farah
// added limit for routes by farah
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per windowMs
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/forgot-password", forgotPasswordLimiter, controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);
router.patch("/change-password", verifyToken, controller.changePassword);

module.exports = router;
