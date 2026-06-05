const appointmentsService = require("./appointments.service");
const dashboardService = require("./dashboard.service");
const queueService = require("./queue.service");
const communicationService = require("./communication.service");
const schedulingService = require("./scheduling.service");
const availabilityService = require("./availability.service");
const realtime = require("./realtime.service");

function ok(res, data, extra = {}) {
  res.json({ success: true, data, ...extra });
}

function err(res, error) {
  const status = error.status || 500;
  res.status(status).json({ success: false, message: error.message || "Error" });
}

// ================= APPOINTMENTS =================
exports.listAppointments = async (req, res) => {
  try {
    const result = await appointmentsService.listAppointments(req.query);
    ok(res, result.data, { page: result.page, limit: result.limit, total: result.total });
  } catch (e) {
    err(res, e);
  }
};

exports.getToday = async (req, res) => {
  try {
    const result = await appointmentsService.getTodayAppointments(req.query);
    ok(res, result.data, { page: result.page, limit: result.limit, total: result.total });
  } catch (e) {
    err(res, e);
  }
};

exports.getAppointment = async (req, res) => {
  try {
    const data = await appointmentsService.getAppointment(req.params.id);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const data = await appointmentsService.createAppointment(req.body, req.user.id);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const data = await appointmentsService.updateStatus(
      req.params.id,
      req.body.status,
      req.user.id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.updatePriority = async (req, res) => {
  try {
    const data = await appointmentsService.updatePriority(
      req.params.id,
      req.body.priority_level,
      req.user.id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.getTimeline = async (req, res) => {
  try {
    const data = await appointmentsService.getTimeline(req.params.id);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

// ================= DASHBOARD =================
exports.getDashboard = async (req, res) => {
  try {
    const data = await dashboardService.getDashboard();
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.getPriorityOverview = async (req, res) => {
  try {
    const data = await dashboardService.getPriorityOverview();
    ok(res, data.data);
  } catch (e) {
    err(res, e);
  }
};

// ================= QUEUE & ARRIVAL BOARD =================
exports.getQueue = async (req, res) => {
  try {
    const result = await queueService.getQueue(req.query);
    ok(res, result.data, { page: result.page, limit: result.limit, total: result.total });
  } catch (e) {
    err(res, e);
  }
};

exports.getQueueHistory = async (req, res) => {
  try {
    const data = await queueService.getQueueHistory(req.params.id);
    ok(res, data.data);
  } catch (e) {
    err(res, e);
  }
};

exports.getArrivalBoard = async (req, res) => {
  try {
    const data = await queueService.getArrivalBoard(req.query);
    ok(res, data.data);
  } catch (e) {
    err(res, e);
  }
};

exports.callPatient = async (req, res) => {
  try {
    await queueService.updateBoardStatus(req.params.id, "Called", req.user.id);
    const appt = await appointmentsService.getAppointment(req.params.id);
    ok(res, appt);
  } catch (e) {
    err(res, e);
  }
};

// ================= COMMUNICATIONS =================
exports.getCommunicationTimeline = async (req, res) => {
  try {
    const data = await communicationService.getTimeline({
      national_id: req.params.nationalId,
      ...req.query,
    });
    ok(res, data, { page: data.page, limit: data.limit, total: data.total });
  } catch (e) {
    err(res, e);
  }
};

exports.createCallback = async (req, res) => {
  try {
    const data = await communicationService.createCallback(req.body, req.user.id);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.listCallbacks = async (req, res) => {
  try {
    const result = await communicationService.listCallbacks(req.query);
    ok(res, result.data, { page: result.page, limit: result.limit, total: result.total });
  } catch (e) {
    err(res, e);
  }
};

exports.updateCallback = async (req, res) => {
  try {
    const data = await communicationService.updateCallbackStatus(
      req.params.id,
      req.body.status,
      req.user.id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.addContactAttempt = async (req, res) => {
  try {
    const data = await communicationService.addContactAttempt(
      req.params.id,
      req.body,
      req.user.id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.addNote = async (req, res) => {
  try {
    const data = await communicationService.addNote(
      req.body.national_id,
      req.body.content,
      req.user.id,
      req.body.appointment_id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

// ================= SCHEDULING =================
exports.suggestSlots = async (req, res) => {
  try {
    const data = await schedulingService.suggestSlots(req.body);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.checkConflict = async (req, res) => {
  try {
    const data = await schedulingService.checkConflict(req.body);
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

// ================= AVAILABILITY =================
exports.getDoctorsAvailability = async (req, res) => {
  try {
    const data = await availabilityService.getAllDoctorsAvailability();
    ok(res, data.data);
  } catch (e) {
    err(res, e);
  }
};

exports.updateDoctorAvailability = async (req, res) => {
  try {
    const data = await availabilityService.updateDoctorStatus(
      req.params.id,
      req.body.status,
      req.body.break_until,
      req.user.id,
    );
    ok(res, data);
  } catch (e) {
    err(res, e);
  }
};

exports.updatePresence = async (req, res) => {
  try {
    await availabilityService.updatePresence(
      req.user.id,
      req.body.is_online ?? true,
      req.body.typing_to_user_id,
    );
    ok(res, { updated: true });
  } catch (e) {
    err(res, e);
  }
};

exports.getPresence = async (req, res) => {
  try {
    const ids = (req.query.user_ids || "").split(",").filter(Boolean).map(Number);
    const data = await availabilityService.getPresence(ids);
    ok(res, data.data);
  } catch (e) {
    err(res, e);
  }
};

// ================= REALTIME SSE =================
exports.streamEvents = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const userId = req.user.id;
  realtime.subscribe(userId, res);

  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on("close", () => clearInterval(heartbeat));
};
