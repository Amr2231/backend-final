// Created by farah
const db = require("../../config/db");

// ==========================================
// LIVE SYSTEM DASHBOARD (Admin)
// Single endpoint — frontend polls every 30s
// ==========================================
exports.getDashboard = async () => {
  // ── USERS ──
  const [[users]] = await db.query(
    `SELECT
       COUNT(*)                                        AS total_users,
       SUM(is_active = 1)                             AS active_users,
       SUM(is_active = 0)                             AS inactive_users,
       SUM(refresh_token IS NOT NULL
           AND refresh_token_expiry > NOW()
           AND is_active = 1)                         AS online_now,
       SUM(lockout_until > NOW())                     AS locked_accounts
     FROM users`,
  );

  // Users by role
  const [usersByRole] = await db.query(
    `SELECT r.role_name, COUNT(*) AS count
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     GROUP BY r.role_name`,
  );

  // New users today
  const [[newUsersToday]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM users
     WHERE DATE(created_at) = CURDATE()`,
  );

  // ── PATIENTS ──
  const [[patients]] = await db.query(
    `SELECT
       COUNT(*)              AS total_patients,
       SUM(is_active = 1)   AS active_patients,
       SUM(is_active = 0)   AS deactivated_patients
     FROM patients`,
  );

  // New patients today (Patients has no created_at — use first study date)
  const [[newPatientsToday]] = await db.query(
    `SELECT COUNT(DISTINCT national_id) AS count
     FROM studies
     WHERE DATE(study_date) = CURDATE()`,
  );

  // ── STUDIES ──
  const [[studies]] = await db.query(
    `SELECT
       COUNT(*)                                     AS total_studies,
       SUM(s.status = 'Scheduled')                   AS scheduled,
       SUM(s.status = 'In Progress')                 AS in_progress,
       SUM(s.status = 'Completed')                   AS completed,
       SUM(DATE(s.study_date) = CURDATE())           AS today
     FROM studies s`,
  );

  // studies last 7 days
  const [studiesByDay] = await db.query(
    `SELECT DATE(study_date) AS day, COUNT(*) AS count
     FROM studies
     WHERE study_date >= NOW() - INTERVAL 7 DAY
     GROUP BY DATE(study_date)
     ORDER BY day ASC`,
  );

  // ── AI ──
  const [[ai]] = await db.query(
    `SELECT
       COUNT(*)                                    AS total_runs,
       SUM(av.status = 'Pending')                 AS pending,
       SUM(av.status = 'Approved')                AS approved,
       SUM(av.status = 'Rejected')                AS rejected,
       SUM(av.status = 'Edited')                  AS edited
     FROM ai_Results ar
     LEFT JOIN AI_Validation av ON ar.study_id = av.study_id`,
  );

  // ── REPORTS ──
  const [[reports]] = await db.query(
    `SELECT
       COUNT(*)                            AS total_reports,
       SUM(report_status = 'Written')     AS written,
       SUM(report_status = 'Signed')      AS signed,
       SUM(DATE(created_at) = CURDATE())  AS today
     FROM Reports`,
  );

  // ── NOTIFICATIONS ──
  const [[notif]] = await db.query(
    `SELECT
       COUNT(*)             AS total,
       SUM(is_read = 0)    AS unread
     FROM notifications`,
  );

  // ── AUDIT ──
  const [[audit]] = await db.query(
    `SELECT COUNT(*) AS today
     FROM auditLogs
     WHERE DATE(created_at) = CURDATE()`,
  );

  const [[failedLogins24h]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM auditLogs
     WHERE action = 'FAILED_LOGIN'
       AND created_at >= NOW() - INTERVAL 24 HOUR`,
  );

  return {
    generated_at: new Date().toISOString(),

    users: {
      ...users,
      by_role: usersByRole,
      new_today: newUsersToday.count,
    },

    patients: {
      ...patients,
      new_today: newPatientsToday.count,
    },

    studies: {
      ...studies,
      last_7_days: studiesByDay,
    },

    ai: {
      ...ai,
    },

    reports: {
      ...reports,
    },

    notifications: {
      ...notif,
    },

    activity: {
      audit_logs_today: audit.today,
      failed_logins_24h: failedLogins24h.count,
    },
  };
};

// ================= DOCTOR DASHBOARD STATS =================
exports.getDoctorDashboard = async (doctor_id) => {
  const today = new Date().toISOString().split("T")[0];

  // Patients scheduled today
  const [todayPatients] = await db.query(
    `SELECT COUNT(*) AS total
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ? AND DATE(s.study_date) = ?`,
    [doctor_id, today],
  );

  // Avg consultation time (minutes) — only positive durations where report signed after study
  const [avgTime] = await db.query(
    `SELECT ROUND(AVG(GREATEST(0, TIMESTAMPDIFF(MINUTE, s.study_date, r.signed_at)))) AS avg_minutes
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     JOIN Reports r  ON r.study_id = s.study_id
     WHERE p.doctor_id = ?
       AND r.report_status = 'Signed'
       AND r.signed_at IS NOT NULL
       AND r.signed_at >= s.study_date`,
    [doctor_id],
  );

  const avgConsultationMin = Math.max(0, avgTime[0]?.avg_minutes ?? 0);

  // Total prescriptions this month (studies completed)
  const [prescriptions] = await db.query(
    `SELECT COUNT(*) AS total
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND s.status = 'Completed'
       AND MONTH(s.study_date) = MONTH(NOW())
       AND YEAR(s.study_date)  = YEAR(NOW())`,
    [doctor_id],
  );

  // Follow-up completion rate
  const [fuDone] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(is_done) AS done
     FROM FollowUpReminders
     WHERE doctor_id = ?`,
    [doctor_id],
  );

  const fuRate =
    fuDone[0].total > 0
      ? Math.round((fuDone[0].done / fuDone[0].total) * 100)
      : 0;

  // Recent patients — latest study per patient for this doctor
  const [recentPatients] = await db.query(
    `SELECT
       p.national_id,
       p.first_name,
       p.last_name,
       p.gender,
       latest.study_id,
       latest.study_type,
       latest.study_date,
       latest.study_status,
       latest.report_status
     FROM patients p
     JOIN (
       SELECT s.national_id, s.study_id, s.study_type, s.study_date,
              s.status AS study_status, r.report_status,
              ROW_NUMBER() OVER (PARTITION BY s.national_id ORDER BY s.study_date DESC, s.study_id DESC) AS rn
       FROM studies s
       LEFT JOIN Reports r ON r.study_id = s.study_id
     ) latest ON latest.national_id = p.national_id AND latest.rn = 1
     WHERE p.doctor_id = ? AND p.is_active = 1
     ORDER BY latest.study_date DESC
     LIMIT 10`,
    [doctor_id],
  );

  // Today's schedule
  const [schedule] = await db.query(
    `SELECT
       p.national_id,
       p.first_name,
       p.last_name,
       s.study_id,
       s.study_type,
       s.study_date,
       s.status
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND DATE(s.study_date) = ?
     ORDER BY s.study_date ASC`,
    [doctor_id, today],
  );

  // Upcoming follow-ups (next 7 days)
  const [followups] = await db.query(
    `SELECT
       f.reminder_id,
       f.due_date,
       f.reason,
       f.priority,
       DATEDIFF(f.due_date, NOW()) AS days_remaining,
       p.first_name,
       p.last_name,
       p.national_id
     FROM FollowUpReminders f
     JOIN patients p ON f.national_id = p.national_id
     WHERE f.doctor_id = ?
       AND f.is_done = 0
       AND f.due_date >= NOW()
       AND f.due_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY f.due_date ASC
     LIMIT 5`,
    [doctor_id],
  );

  // Watchlist critical cases
  const [watchlist] = await db.query(
    `SELECT
       w.national_id,
       w.note,
       w.priority,
       p.first_name,
       p.last_name
     FROM Watchlist w
     JOIN patients p ON w.national_id = p.national_id
     WHERE w.doctor_id = ?
     ORDER BY FIELD(w.priority,'critical','monitor','stable')
     LIMIT 5`,
    [doctor_id],
  );

  // AI accept rate
  const [aiStats] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(IF(av.status='Approved',1,0)) AS approved
     FROM AI_Validation av
     JOIN studies s ON av.study_id = s.study_id
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?`,
    [doctor_id],
  );

  const aiRate =
    aiStats[0].total > 0
      ? Math.round((aiStats[0].approved / aiStats[0].total) * 100)
      : 0;

  return {
    stats: {
      patients_today: todayPatients[0].total,
      avg_consultation_min: avgConsultationMin,
      prescriptions_month: prescriptions[0].total,
      followup_completion_pct: fuRate,
      ai_accept_rate_pct: aiRate,
    },
    recent_patients: recentPatients,
    today_schedule: schedule,
    upcoming_followups: followups,
    watchlist,
  };
};

// ================= DOCTOR PERFORMANCE (Analytics page) =================
exports.getDoctorPerformance = async (doctor_id, period = "month") => {
  const intervalMap = { week: 7, month: 30, quarter: 90, year: 365 };
  const days = intervalMap[period] || 30;

  // studies completed in period
  const [completed] = await db.query(
    `SELECT COUNT(*) AS total
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ? AND s.status = 'Completed'
       AND s.study_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [doctor_id, days],
  );

  // Total studies in period
  const [totalStudies] = await db.query(
    `SELECT COUNT(*) AS total
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND s.study_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [doctor_id, days],
  );

  const completionRate =
    totalStudies[0].total > 0
      ? Math.round((completed[0].total / totalStudies[0].total) * 100)
      : 0;

  // Reports signed on-time (within 24h of study)
  const [onTime] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Reports r
     JOIN studies s ON r.study_id = s.study_id
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND r.report_status = 'Signed'
       AND TIMESTAMPDIFF(HOUR, s.study_date, r.signed_at) <= 24
       AND s.study_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [doctor_id, days],
  );

  const [totalReports] = await db.query(
    `SELECT COUNT(*) AS total
     FROM Reports r
     JOIN studies s ON r.study_id = s.study_id
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND r.report_status = 'Signed'
       AND s.study_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [doctor_id, days],
  );

  const onTimeRate =
    totalReports[0].total > 0
      ? Math.round((onTime[0].total / totalReports[0].total) * 100)
      : 0;

  // Follow-up rate
  const [fu] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(is_done) AS done
     FROM FollowUpReminders
     WHERE doctor_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [doctor_id, days],
  );

  const fuRate =
    fu[0].total > 0 ? Math.round((fu[0].done / fu[0].total) * 100) : 0;

  // Monthly activity (last 12 months)
  const [monthly] = await db.query(
    `SELECT
       YEAR(s.study_date)  AS yr,
       MONTH(s.study_date) AS mo,
       COUNT(*) AS count
     FROM studies s
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?
       AND s.study_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY yr, mo
     ORDER BY yr, mo`,
    [doctor_id],
  );

  // Diagnosis distribution
  const [diagnoses] = await db.query(
    `SELECT
       SUM(has_hfref = 1 AND has_lvh = 0)                   AS hfref_only,
       SUM(has_lvh  = 1 AND has_hfref = 0)                  AS lvh_only,
       SUM(has_hfref = 1 AND has_lvh = 1)                   AS both_conditions,
       SUM(ejection_fraction >= 55)                          AS normal,
       SUM(ejection_fraction >= 40 AND ejection_fraction < 55) AS borderline
     FROM ai_Results ar
     JOIN studies s ON ar.study_id = s.study_id
     JOIN patients p ON s.national_id = p.national_id
     WHERE p.doctor_id = ?`,
    [doctor_id],
  );

  return {
    period,
    performance: {
      completion_rate: completionRate,
      on_time_rate: onTimeRate,
      followup_rate: fuRate,
      ai_accept_rate: 0, // already calculated above if needed
      studies_completed: completed[0].total,
      reports_signed: totalReports[0].total,
    },
    monthly_activity: monthly,
    diagnosis_distribution: diagnoses[0],
  };
};
