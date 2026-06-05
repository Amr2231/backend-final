// ================= created by farah =================
const service = require("./followup.service");

exports.create = async (req, res, next) => {
  try {
    const { national_id, days, reason, priority } = req.body;
    const result = await service.createReminder(
      req.user.id,
      national_id,
      days,
      reason,
      priority,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { filter } = req.query; // all | today | overdue | upcoming
    const result = await service.getMyReminders(req.user.id, filter);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.markDone = async (req, res, next) => {
  try {
    const result = await service.markDone(req.user.id, req.params.reminder_id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { days, reason, priority } = req.body;
    const result = await service.updateReminder(
      req.user.id,
      req.params.reminder_id,
      days,
      reason,
      priority,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await service.deleteReminder(
      req.user.id,
      req.params.reminder_id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
