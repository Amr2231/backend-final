// Created by farah
const service = require("./notification.service");

exports.getMyNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await service.getUserNotifications(req.user.id, page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const result = await service.markAsRead(
      req.params.notification_id,
      req.user.id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const result = await service.markAllAsRead(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const result = await service.deleteNotification(
      req.params.notification_id,
      req.user.id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ success: false, message: err.message });
  }
};
