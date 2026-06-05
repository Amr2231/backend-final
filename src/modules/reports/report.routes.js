const router = require("express").Router();
const controller = require("./report.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");
const notify = require("../../middleware/notify.middleware");

router.get("/open/:study_id", auth, role("Doctor"), controller.openReport);

router.get("/pdf/:study_id", auth, notify.onReportAccess, controller.exportPDF);

router.get("/:study_id", auth, controller.getReport);

router.put("/save/:study_id", auth, role("Doctor"), controller.autoSave);

router.post(
  "/insert-ai/:study_id",
  auth,
  role("Doctor"),
  controller.insertAIFindings,
);

router.post("/finalize/:study_id", auth, role("Doctor"), notify.onReportFinalized, controller.finalize);

module.exports = router;
