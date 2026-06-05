// ================= Created by Farah =================
const router = require("express").Router();
const ctrl = require("./watchlist.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

// Doctor only
router.get("/", auth, role("Doctor"), ctrl.getAll);
router.post("/", auth, role("Doctor"), ctrl.add);
router.delete("/:national_id", auth, role("Doctor"), ctrl.remove);
router.patch("/:national_id", auth, role("Doctor"), ctrl.update);

module.exports = router;
