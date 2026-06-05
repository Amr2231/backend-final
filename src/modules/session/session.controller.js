// Created by farah
const service = require("./session.service");

// ==========================================
// GET ACTIVE SESSIONS
// ==========================================
exports.getActiveSessions = async (req, res) => {
  try {
    const result = await service.getActiveSessions(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

// ==========================================
// GET SESSION STATS
// ==========================================
exports.getSessionStats = async (req, res) => {
  try {
    const result = await service.getSessionStats();
    res.json({ success: true, data: result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

// ==========================================
// FORCE LOGOUT ONE USER
// ==========================================
exports.forceLogout = async (req, res) => {
  try {
    const result = await service.forceLogout(req.params.user_id, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

// ==========================================
// FORCE LOGOUT ALL
// ==========================================
exports.forceLogoutAll = async (req, res) => {
  try {
    const result = await service.forceLogoutAll(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};
