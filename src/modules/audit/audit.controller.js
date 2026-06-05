// Created by farah
const service = require("./audit.service");

exports.getLogs = async (req, res) => {
  try {
    const result = await service.getLogs(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};