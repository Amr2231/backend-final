// Created by farah
const service = require("./security.service");

exports.getOverview = async (req, res) => {
  try {
    const data = await service.getSecurityOverview();
    res.json({ success: true, data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getLockedAccounts = async (req, res) => {
  try {
    const data = await service.getLockedAccounts();
    res.json({ success: true, ...data });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.unlockAccount = async (req, res) => {
  try {
    const result = await service.unlockAccount(req.params.user_id);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.getFailedLoginLogs = async (req, res) => {
  try {
    const result = await service.getFailedLoginLogs(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};
