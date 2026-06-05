const jwt = require("jsonwebtoken");
const db = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    const headerToken = req.headers.authorization?.split(" ")[1];
    const queryToken = req.query?.token;
    const token = headerToken || queryToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id ?? decoded.user_id ?? decoded.sub;

    if (userId) {
      const [rows] = await db.query(
        `SELECT
           u.user_id,
           u.first_name,
           u.last_name,
           u.email,
           u.username,
           r.role_name
         FROM Users u
         JOIN Roles r ON u.role_id = r.role_id
         WHERE u.user_id = ? AND u.is_active = 1`,
        [userId],
      );

      if (rows.length) {
        const profile = rows[0];
        req.user = {
          id: profile.user_id,
          user_id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          username: profile.username,
          role: profile.role_name,
        };
        return next();
      }
    }

    req.user = {
      id: userId ?? decoded.id,
      role: decoded.role,
      ...decoded,
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
