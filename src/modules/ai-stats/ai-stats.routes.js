// Created by farah
const router = require("express").Router();
const ctrl = require("./ai-stats.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

router.get("/stats", auth, role("Admin"), ctrl.getStats); // overview numbers
router.get("/results", auth, role("Admin"), ctrl.getResults); // paginated list

module.exports = router;
