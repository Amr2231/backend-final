const router = require("express").Router();
const ctrl = require("./dashboard.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

router.get("/", auth, role("Doctor"), ctrl.getDoctorDashboard);
router.get("/performance", auth, role("Doctor"), ctrl.getDoctorPerformance);

module.exports = router;
