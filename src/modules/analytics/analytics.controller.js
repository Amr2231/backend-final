// Created by farah
const service = require("./analytics.service");

exports.getHeatmap = async (req, res) => {
  try {
    const data = await service.getAccessHeatmap(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getFileAccess = async (req, res) => {
  try {
    const result = await service.getFileAccessLogs(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getGeoMap = async (req, res) => {
  try {
    const data = await service.getGeoLoginMap(req.query);
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};
