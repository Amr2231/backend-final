// created by farah
const router = require("express").Router();
const ctrl = require("./analytics.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

router.get("/heatmap", auth, role("Admin"), ctrl.getHeatmap); // Data Access Heatmap
router.get("/file-access", auth, role("Admin"), ctrl.getFileAccess); // File Access Monitoring
router.get("/geo-logins", auth, role("Admin"), ctrl.getGeoMap); // Geo Login Tracking

module.exports = router;
