const router = require("express").Router();

const controller = require("./patient.controller");

const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");
const notify = require("../../middleware/notify.middleware");

// ======================================================
// RECEPTIONIST
// ======================================================

router.post(
  "/",
  auth,
  role("Receptionist"),
  notify.onPatientRegister,
  controller.register,
);
router.patch(
  "/:national_id/reassign-doctor",
  auth,
  role("Receptionist"),
  notify.onDoctorReassign,
  controller.reassignDoctor,
);
router.put(
  "/:national_id",
  auth,
  role("Receptionist"),
  notify.onPatientUpdate,
  controller.update,
);
router.delete(
  "/:national_id",
  auth,
  role("Receptionist"),
  notify.onPatientDelete,
  controller.delete,
);

// ======================================================
// RECEPTIONIST + DOCTOR
// ======================================================

// Query Patients
router.get("/", auth, role("Receptionist", "Doctor"), controller.queryPatients);

// UC-34 Active Patients
router.get(
  "/active",
  auth,
  role("Receptionist", "Doctor"),
  controller.getActive,
);

// UC-36 Historical Patients
router.get(
  "/history",
  auth,
  role("Receptionist", "Doctor"),
  controller.getHistory,
);

// ======================================================
// DOCTOR
// ======================================================

// UC-17 View Assigned Patients
router.get("/assigned", auth, role("Doctor"), controller.getAssigned);
// doctor history [created by farah] (RBAC)
router.get("/my-history", auth, role("Doctor"), controller.getDoctorHistory);

// View deactivated patients (Admin only)[created by farah]
router.get("/deactivated", auth, role("Admin"), controller.getDeactivated);

// Reactivate patient [Admin only] [created by farah]
router.patch(
  "/:national_id/reactivate",
  auth,
  role("Admin"),
  controller.reactivate,
);

// Get recent patients [created by farah]
router.get("/recent", auth, role("Doctor"), controller.getRecentPatients);

// Resolve patient context by study id (includes completed studies)
router.get(
  "/study/:study_id",
  auth,
  role("Doctor"),
  controller.getByStudyId,
);
module.exports = router;
