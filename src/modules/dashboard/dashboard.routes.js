// Created by farah
const router = require("express").Router();
const ctrl = require("./dashboard.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

// Single endpoint — poll every 30s from frontend (Admin only)
router.get("/", auth, role("Admin"), ctrl.getDashboard);
module.exports = router;
