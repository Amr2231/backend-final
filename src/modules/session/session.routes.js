// Created by farah
const router = require("express").Router();
const ctrl = require("./session.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

// Admin only
router.get("/", auth, role("Admin"), ctrl.getActiveSessions); // list active sessions
router.get("/stats", auth, role("Admin"), ctrl.getSessionStats); // counts + by role
router.delete("/logout-all", auth, role("Admin"), ctrl.forceLogoutAll); // nuke all sessions
router.delete("/:user_id", auth, role("Admin"), ctrl.forceLogout); // terminate one session

module.exports = router;
