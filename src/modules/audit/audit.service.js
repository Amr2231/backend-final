// Created by farah
const db = require("../../config/db");

const { lookupGeo } = require("../../utils/geo");

// ==========================================
// LOG ACTION
// ==========================================
exports.log = async ({
  actor_id = null,
  actor_name = null,
  actor_role = null,
  action,
  entity,
  entity_id = null,
  description = null,
  ip_address = null,
}) => {
  try {
    const geo = lookupGeo(ip_address);
    await db.query(
      `INSERT INTO auditlogs
        (actor_id, actor_name, actor_role, action, entity, entity_id, description, ip_address, geo_country, geo_city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor_id,
        actor_name,
        actor_role,
        action,
        entity,
        entity_id,
        description,
        ip_address,
        geo.country,
        geo.city,
      ],
    );
  } catch (err) {
    try {
      await db.query(
        `INSERT INTO auditlogs
          (actor_id, actor_name, actor_role, action, entity, entity_id, description, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actor_id,
          actor_name,
          actor_role,
          action,
          entity,
          entity_id,
          description,
          ip_address,
        ],
      );
    } catch (fallbackErr) {
      console.error("⚠️ Audit log insert failed:", fallbackErr.message);
    }
  }
};

// ==========================================
// GET AUDIT LOGS (Admin)
// ==========================================
exports.getLogs = async (filters = {}) => {
  let {
    actor_id,
    action,
    entity,
    entity_id,
    from_date,
    to_date,
    keyword,
    page = 1,
    limit = 20,
    sort = "created_at",
    order = "DESC",
  } = filters;

  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params = [];
  const cParams = [];

  if (actor_id) {
    where += " AND al.actor_id = ?";
    params.push(actor_id);
    cParams.push(actor_id);
  }

  if (action) {
    where += " AND al.action = ?";
    params.push(action);
    cParams.push(action);
  }

  if (entity) {
    where += " AND al.entity = ?";
    params.push(entity);
    cParams.push(entity);
  }

  if (entity_id) {
    where += " AND al.entity_id = ?";
    params.push(entity_id);
    cParams.push(entity_id);
  }

  if (from_date) {
    where += " AND DATE(al.created_at) >= ?";
    params.push(from_date);
    cParams.push(from_date);
  }

  if (to_date) {
    where += " AND DATE(al.created_at) <= ?";
    params.push(to_date);
    cParams.push(to_date);
  }

  if (keyword) {
    where += ` AND (
      al.actor_name LIKE ? OR
      al.description LIKE ? OR
      al.entity_id LIKE ?
    )`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    cParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const allowedSort = ["created_at", "action", "entity", "actor_name"];
  const allowedOrder = ["ASC", "DESC"];
  if (!allowedSort.includes(sort)) sort = "created_at";
  if (!allowedOrder.includes(order.toUpperCase())) order = "DESC";

  const [rows] = await db.query(
    `SELECT
       al.*,
       COALESCE(
         NULLIF(TRIM(al.actor_name), ''),
         NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
         u.email
       ) AS actor_display_name,
       COALESCE(NULLIF(TRIM(al.actor_role), ''), r.role_name) AS actor_display_role
     FROM auditlogs al
     LEFT JOIN users u ON al.actor_id = u.user_id
     LEFT JOIN roles r ON u.role_id = r.role_id
     ${where}
     ORDER BY al.${sort} ${order}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  for (const row of rows) {
    if (row.actor_display_name) row.actor_name = row.actor_display_name;
    if (row.actor_display_role) row.actor_role = row.actor_display_role;
    delete row.actor_display_name;
    delete row.actor_display_role;
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM auditlogs al ${where}`,
    cParams,
  );

  return {
    page,
    limit,
    total: countRows[0].total,
    pages: Math.ceil(countRows[0].total / limit),
    data: rows,
  };
};
