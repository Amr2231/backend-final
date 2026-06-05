const router = require("express").Router();
const ctrl = require("./reception.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");

const receptionRoles = role("Receptionist", "Admin");
const staffRoles = role("Receptionist", "Doctor", "Admin");

// Realtime
router.get("/events", auth, staffRoles, ctrl.streamEvents);

// Dashboard
router.get("/dashboard", auth, receptionRoles, ctrl.getDashboard);
router.get("/priority-overview", auth, receptionRoles, ctrl.getPriorityOverview);

// Appointments
router.get("/appointments/today", auth, receptionRoles, ctrl.getToday);
router.get("/appointments", auth, receptionRoles, ctrl.listAppointments);
router.get("/appointments/:id/timeline", auth, receptionRoles, ctrl.getTimeline);
router.get("/appointments/:id", auth, receptionRoles, ctrl.getAppointment);
router.post("/appointments", auth, receptionRoles, ctrl.createAppointment);
router.patch("/appointments/:id/status", auth, receptionRoles, ctrl.updateStatus);
router.patch("/appointments/:id/priority", auth, receptionRoles, ctrl.updatePriority);

// Queue & Arrival Board
router.get("/queue", auth, receptionRoles, ctrl.getQueue);
router.get("/queue/:id/history", auth, receptionRoles, ctrl.getQueueHistory);
router.get("/arrival-board", auth, receptionRoles, ctrl.getArrivalBoard);
router.post("/arrival-board/:id/call", auth, receptionRoles, ctrl.callPatient);

// Communications
router.get("/communications/:nationalId/timeline", auth, receptionRoles, ctrl.getCommunicationTimeline);
router.post("/communications/notes", auth, receptionRoles, ctrl.addNote);
router.get("/callbacks", auth, receptionRoles, ctrl.listCallbacks);
router.post("/callbacks", auth, receptionRoles, ctrl.createCallback);
router.patch("/callbacks/:id", auth, receptionRoles, ctrl.updateCallback);
router.post("/callbacks/:id/attempts", auth, receptionRoles, ctrl.addContactAttempt);

// Smart Scheduling
router.post("/scheduling/suggest", auth, receptionRoles, ctrl.suggestSlots);
router.post("/scheduling/check-conflict", auth, receptionRoles, ctrl.checkConflict);

// Doctor Availability
router.get("/doctors/availability", auth, receptionRoles, ctrl.getDoctorsAvailability);
router.patch("/doctors/:id/availability", auth, staffRoles, ctrl.updateDoctorAvailability);

// Presence (chat)
router.patch("/presence", auth, staffRoles, ctrl.updatePresence);
router.get("/presence", auth, staffRoles, ctrl.getPresence);

module.exports = router;
