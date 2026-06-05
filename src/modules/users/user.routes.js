// Added Notification by Farah
const router = require("express").Router();
const controller = require("./user.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");
const notify = require("../../middleware/notify.middleware");

// Admin only
router.get("/", auth, role("Admin", "Receptionist"), controller.getUsers);
router.post("/",                   auth, role("Admin"), notify.onUserCreate,     controller.create);
router.put("/:id", auth, role("Admin"), controller.update);

router.patch("/:id/deactivate",    auth, role("Admin"), notify.onUserDeactivate, controller.deactivate);
router.patch("/:id/reactivate",    auth, role("Admin"), notify.onUserReactivate, controller.reactivate)

router.post("/transfer",           auth, role("Admin"), notify.onPatientsTransfer, controller.transfer);


router.delete("/:id", auth, role("Admin"), controller.delete);

// Settings Page
router.patch("/profile", auth, controller.updateProfile);
router.delete("/profile", auth, controller.deleteOwnAccount);

module.exports = router;