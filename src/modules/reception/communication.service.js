const db = require("../../config/db");
const realtime = require("./realtime.service");

exports.logCommunication = async ({
  national_id,
  appointment_id,
  type,
  title,
  content,
  metadata,
  created_by,
}) => {
  const [result] = await db.query(
    `INSERT INTO PatientCommunications
       (national_id, appointment_id, type, title, content, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      national_id,
      appointment_id || null,
      type,
      title,
      content || null,
      metadata ? JSON.stringify(metadata) : null,
      created_by,
    ],
  );
  return { communication_id: result.insertId };
};

exports.getTimeline = async (filters = {}) => {
  const { national_id, type, search, page = 1, limit = 30 } = filters;
  if (!national_id) throw { status: 400, message: "national_id is required" };

  let where = "pc.national_id = ?";
  const params = [national_id];

  if (type) {
    where += " AND pc.type = ?";
    params.push(type);
  }
  if (search?.trim()) {
    where += " AND (pc.title LIKE ? OR pc.content LIKE ?)";
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }

  const lim = Math.min(100, Math.max(1, parseInt(limit) || 30));
  const pg = Math.max(1, parseInt(page) || 1);
  const offset = (pg - 1) * lim;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM PatientCommunications pc WHERE ${where}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT
       pc.*,
       CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
     FROM PatientCommunications pc
     JOIN users u ON pc.created_by = u.user_id
     WHERE ${where}
     ORDER BY pc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );

  return {
    page: pg,
    limit: lim,
    total: countRows[0].total,
    communications: rows,
  };
};

exports.addNote = async (national_id, content, userId, appointment_id) => {
  if (!national_id || !content?.trim()) {
    throw { status: 400, message: "national_id and content are required" };
  }
  return exports.logCommunication({
    national_id,
    appointment_id,
    type: "Note",
    title: "Staff note",
    content: content.trim(),
    created_by: userId,
  });
};
