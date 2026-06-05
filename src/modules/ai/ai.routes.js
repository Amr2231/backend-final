// ================= AI PIPELINE =================

const router = require("express").Router();
const controller = require("./ai.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");
const notify = require("../../middleware/notify.middleware");
// const notify = require("../../middleware/notify.middleware");


router.post("/run/:study_id",      auth, role("Doctor"), notify.onAIRun,       controller.runAI);
router.post("/validate/:study_id", auth, role("Doctor"), notify.onAIValidate,  controller.validateAI);
router.put("/edit/:study_id",      auth, role("Doctor"), notify.onAIEdit,      controller.editAI);
router.get("/:study_id",           auth, role("Doctor"), controller.getAIResult);

// // Get AI full result
// router.get(
//   "/:study_id",
//   auth,
//   controller.getAI
// );

module.exports = router;
