// ================= created by farah =================
const service = require("./watchlist.service");

exports.add = async (req, res, next) => {
  try {
    const { national_id, note, priority } = req.body;
    const result = await service.addToWatchlist(
      req.user.id,
      national_id,
      note,
      priority,
    );
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await service.removeFromWatchlist(
      req.user.id,
      req.params.national_id,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const result = await service.getWatchlist(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { note, priority } = req.body;
    const result = await service.updateWatchlistItem(
      req.user.id,
      req.params.national_id,
      note,
      priority,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
