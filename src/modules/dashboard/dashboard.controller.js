// Created by farah
const service = require("./dashboard.service");

exports.getDashboard = async (req, res) => {
  try {
    const data = await service.getDashboard();
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getDoctorDashboard = async (req, res, next) => {
  try {
    const result = await service.getDoctorDashboard(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getDoctorPerformance = async (req, res, next) => {
  try {
    const { period } = req.query; // week | month | quarter | year
    const result = await service.getDoctorPerformance(req.user.id, period);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
