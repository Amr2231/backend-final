// Created by farah
const db = require("../../config/db");

// ==========================================
// AI OVERVIEW STATS (Admin)
// ==========================================
exports.getAIStats = async () => {
  // Total runs
  const [[totalRuns]] = await db.query(
    `SELECT COUNT(*) AS total FROM aI_Results`,
  );

  // By validation status
  const [byStatus] = await db.query(
    `SELECT status, COUNT(*) AS count
     FROM AI_Validation
     GROUP BY status`,
  );

  // Diagnosis distribution (`both` is reserved in MariaDB — use safe alias)
  const [diagnoses] = await db.query(
    `SELECT
       SUM(CASE WHEN has_hfref=0 AND has_lvh=0 THEN 1 ELSE 0 END) AS normal,
       SUM(CASE WHEN has_hfref=1 AND has_lvh=0 THEN 1 ELSE 0 END) AS hf_only,
       SUM(CASE WHEN has_hfref=0 AND has_lvh=1 THEN 1 ELSE 0 END) AS lvh_only,
       SUM(CASE WHEN has_hfref=1 AND has_lvh=1 THEN 1 ELSE 0 END) AS both_count
     FROM aI_Results`,
  );

  // Average EF + wall thickness
  const [[averages]] = await db.query(
    `SELECT
       ROUND(AVG(ejection_fraction), 2) AS avg_ef,
       ROUND(AVG(wall_thickness), 2)    AS avg_wall_thickness
     FROM aI_Results`,
  );

  // Runs last 7 days
  const [runsByDay] = await db.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM aI_Results
     WHERE created_at >= NOW() - INTERVAL 7 DAY
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
  );

  // Edited results (doctor made changes) — table may be empty on fresh installs
  let editedTotal = 0;
  try {
    const [[edited]] = await db.query(
      `SELECT COUNT(DISTINCT study_id) AS total FROM AI_Edits`,
    );
    editedTotal = edited.total ?? 0;
  } catch {
    editedTotal = 0;
  }

  const dist = diagnoses[0] ?? {};

  return {
    total_runs: totalRuns.total,
    edited_results: editedTotal,
    by_status: byStatus,
    diagnosis_dist: {
      normal: Number(dist.normal) || 0,
      hf_only: Number(dist.hf_only) || 0,
      lvh_only: Number(dist.lvh_only) || 0,
      both: Number(dist.both_count) || 0,
    },
    averages: {
      avg_ef: Number(averages?.avg_ef) || 0,
      avg_wall_thickness: Number(averages?.avg_wall_thickness) || 0,
    },
    runs_last_7_days: runsByDay,
  };
};

// ==========================================
// AI RESULTS LIST (Admin — paginated)
// ==========================================
exports.getAIResults = async (filters = {}) => {
  let { page = 1, limit = 20, status, from_date, to_date } = filters;

  page = parseInt(page);
  limit = parseInt(limit);
  if (page < 1) page = 1;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  let where = `WHERE 1=1`;
  const params = [];
  const cParams = [];

  if (status) {
    where += ` AND av.status = ?`;
    params.push(status);
    cParams.push(status);
  }

  if (from_date) {
    where += ` AND DATE(ar.created_at) >= ?`;
    params.push(from_date);
    cParams.push(from_date);
  }

  if (to_date) {
    where += ` AND DATE(ar.created_at) <= ?`;
    params.push(to_date);
    cParams.push(to_date);
  }

  const [rows] = await db.query(
    `SELECT
       ar.*,
       av.status       AS validation_status,
       av.validated_by,
       av.validated_at,
       CONCAT(u.first_name,' ',u.last_name) AS validated_by_name
     FROM aI_Results ar
     LEFT JOIN AI_Validation av ON ar.study_id = av.study_id
     LEFT JOIN users u ON av.validated_by = u.user_id
     ${where}
     ORDER BY ar.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [[count]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM aI_Results ar
     LEFT JOIN AI_Validation av ON ar.study_id = av.study_id
     ${where}`,
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
