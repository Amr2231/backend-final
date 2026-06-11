// ================= CHAT ROUTES =================
const router = require("express").Router();
const ctrl = require("./chat.controller");
const auth = require("../../middleware/auth.middleware");

router.get("/users", auth, ctrl.searchUsers);
router.get("/inbox", auth, ctrl.getInbox);
router.get("/unread", auth, ctrl.getUnread);
router.get("/patient-threads", auth, ctrl.getPatientThreads);
router.post("/", auth, ctrl.send);
router.get("/:user_id", auth, ctrl.getConversation);

module.exports = router;
