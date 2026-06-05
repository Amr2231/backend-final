const service = require("./doctor-schedule.service");

exports.getMySchedule = async (req, res, next) => {
  try {
    const data = await service.getSchedule(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.saveMySchedule = async (req, res, next) => {
  try {
    const data = await service.saveSchedule(req.user.id, req.body.days || []);
    res.json({ success: true, data, message: "Schedule saved" });
  } catch (err) {
    next(err);
  }
};

exports.addHoliday = async (req, res, next) => {
  try {
    const data = await service.addHoliday(
      req.user.id,
      req.body.holiday_date,
      req.body.reason,
    );
    res.json({ success: true, data, message: "Holiday added" });
  } catch (err) {
    next(err);
  }
};

exports.removeHoliday = async (req, res, next) => {
  try {
    await service.removeHoliday(req.user.id, req.params.holiday_id);
    res.json({ success: true, message: "Holiday removed" });
  } catch (err) {
    next(err);
  }
};
