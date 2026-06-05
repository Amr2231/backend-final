// ================= CHAT CONTROLLER =================
const service = require("./chat.service");

exports.send = async (req, res, next) => {
  try {
    const result = await service.sendMessage(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await service.getConversation(
      req.user.id,
      req.params.user_id,
      page,
      limit,
      req.query.patient_id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getInbox = async (req, res, next) => {
  try {
    const result = await service.getInbox(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getUnread = async (req, res, next) => {
  try {
    const result = await service.getUnreadCount(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getPatientThreads = async (req, res, next) => {
  try {
    const result = await service.getPatientContextThreads(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.setTyping = async (req, res, next) => {
  try {
    await service.setTyping(req.user.id, req.body.typing_to_user_id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.searchUsers = async (req, res, next) => {
  try {
    const result = await service.searchUsers(
      req.user.id,
      req.query.q,
      req.query.limit,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
