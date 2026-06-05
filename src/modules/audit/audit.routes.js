// Created by farah
const router = require("express").Router();
const ctrl = require("./audit.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

// Admin only — full audit trail
router.get("/", auth, role("Admin"), ctrl.getLogs);

module.exports = router;
