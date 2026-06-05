// Created by farah
const service = require("./ai-stats.service");

exports.getStats = async (req, res) => {
  try {
    const data = await service.getAIStats();
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getResults = async (req, res) => {
  try {
    const result = await service.getAIResults(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};
