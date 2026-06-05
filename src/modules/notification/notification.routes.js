const router = require("express").Router();
const ctrl = require("./notification.controller");
const auth = require("../../middleware/auth.middleware");

router.get("/", auth, ctrl.getMyNotifications);
router.patch("/:notification_id/read", auth, ctrl.markAsRead);
router.patch("/read-all", auth, ctrl.markAllAsRead);
router.delete("/:notification_id", auth, ctrl.deleteNotification);

module.exports = router;
