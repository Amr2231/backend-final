// ================= Created by Farah =================
const router = require("express").Router();
const ctrl = require("./followup.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

router.get("/", auth, role("Doctor"), ctrl.getAll); // ?filter=today|overdue|upcoming
router.post("/", auth, role("Doctor"), ctrl.create);
router.patch("/:reminder_id", auth, role("Doctor"), ctrl.update);
router.patch("/:reminder_id/done", auth, role("Doctor"), ctrl.markDone);
router.delete("/:reminder_id", auth, role("Doctor"), ctrl.delete);

module.exports = router;
