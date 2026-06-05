const router = require("express").Router();
const ctrl = require("./doctor-schedule.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

router.get("/", auth, role("Doctor"), ctrl.getMySchedule);
router.put("/", auth, role("Doctor"), ctrl.saveMySchedule);
router.post("/holidays", auth, role("Doctor"), ctrl.addHoliday);
router.delete("/holidays/:holiday_id", auth, role("Doctor"), ctrl.removeHoliday);

module.exports = router;
