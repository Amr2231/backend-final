// Created by farah
const db = require("../../config/db").default;

exports.getAccessHeatmap = async (filters = {}) => {
  const { from_date, to_date, actor_id } = filters;

  let where = `WHERE 1=1`;
  const params = [];

  if (from_date) {
    where += ` AND DATE(created_at) >= ?`;
    params.push(from_date);
  }
  if (to_date) {
    where += ` AND DATE(created_at) <= ?`;
    params.push(to_date);
  }
  if (actor_id) {
    where += ` AND actor_id = ?`;
    params.push(actor_id);
  }

  // hour-of-day × day-of-week matrix
  const [matrix] = await db.query(
    `SELECT
       HOUR(created_at)        AS hour_of_day,
       DAYOFWEEK(created_at)   AS day_of_week,
       COUNT(*)                AS count
     FROM AuditLogs
     ${where}
     GROUP BY HOUR(created_at), DAYOFWEEK(created_at)
     ORDER BY day_of_week, hour_of_day`,
    params,
  );

  // top actors by action count
  const [topActors] = await db.query(
    `SELECT
       actor_id,
       actor_name,
       actor_role,
       COUNT(*) AS total_actions
     FROM AuditLogs
     ${where}
     GROUP BY actor_id, actor_name, actor_role
     ORDER BY total_actions DESC
     LIMIT 10`,
    params,
  );

  // actions breakdown
  const [actionBreakdown] = await db.query(
    `SELECT action, COUNT(*) AS count
     FROM AuditLogs
     ${where}
     GROUP BY action
     ORDER BY count DESC`,
    params,
  );

  return { matrix, top_actors: topActors, action_breakdown: actionBreakdown };
};

// ==========================================
// FILE ACCESS MONITORING
// Reads from AuditLogs where entity = 'Image' or 'Report'
// (You need to log these in study.routes.js — see patch below)
// ==========================================
exports.getFileAccessLogs = async (filters = {}) => {
  let { page = 1, limit = 20, entity, actor_id, from_date, to_date } = filters;

  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  let where = `WHERE entity IN ('Image','Report')`;
  const params = [];
  const cParams = [];

  if (entity) {
    where += ` AND entity = ?`;
    params.push(entity);
    cParams.push(entity);
  }

  if (actor_id) {
    where += ` AND actor_id = ?`;
    params.push(actor_id);
    cParams.push(actor_id);
  }

  if (from_date) {
    where += ` AND DATE(created_at) >= ?`;
    params.push(from_date);
    cParams.push(from_date);
  }

  if (to_date) {
    where += ` AND DATE(created_at) <= ?`;
    params.push(to_date);
    cParams.push(to_date);
  }

  const [rows] = await db.query(
    `SELECT * FROM AuditLogs
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total FROM AuditLogs ${where}`,
    cParams,
  );

  return {
    page,
    limit,
    total: count.total,
    pages: Math.ceil(count.total / limit),
    data: rows,
  };
};

// ==========================================
// GEO LOGIN TRACKING
// Uses geoip-lite — npm install geoip-lite
// ==========================================
let geoip;
try {
  geoip = require("geoip-lite");
} catch {
  geoip = null;
}

const { lookupGeo } = require("../../utils/geo");

exports.getGeoLoginMap = async (filters = {}) => {
  const { from_date, to_date } = filters;

  let where = `WHERE action IN ('LOGIN','FAILED_LOGIN') AND ip_address IS NOT NULL`;
  const params = [];

  if (from_date) {
    where += ` AND DATE(created_at) >= ?`;
    params.push(from_date);
  }
  if (to_date) {
    where += ` AND DATE(created_at) <= ?`;
    params.push(to_date);
  }

  const [rows] = await db.query(
    `SELECT
       actor_id,
       actor_name,
       actor_role,
       action,
       ip_address,
       created_at
     FROM AuditLogs
     ${where}
     ORDER BY created_at DESC
     LIMIT 500`,
    params,
  );

  // Attach geo to each row (in-process, no extra DB call)
  const enriched = rows.map((row) => ({
    ...row,
    geo: lookupGeo(row.ip_address),
  }));

  // Summary: unique countries
  const countries = {};
  for (const r of enriched) {
    if (r.geo?.country) {
      countries[r.geo.country] = (countries[r.geo.country] || 0) + 1;
    }
  }

  return {
    total: enriched.length,
    countries: Object.entries(countries)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    data: enriched,
  };
};
