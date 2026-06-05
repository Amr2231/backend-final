// created by farah
const router = require("express").Router();
const ctrl = require("./security.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

// Admin only
router.get("/overview", auth, role("Admin"), ctrl.getOverview); // dashboard stats
router.get("/locked-accounts", auth, role("Admin"), ctrl.getLockedAccounts); // who is locked
router.get("/failed-logins", auth, role("Admin"), ctrl.getFailedLoginLogs); // full log
router.patch("/unlock/:user_id", auth, role("Admin"), ctrl.unlockAccount); // manual unlock

module.exports = router;
