const db = require("../../config/db").default;
const realtime = require("./realtime.service");

exports.getDashboard = async () => {
  const today = new Date().toISOString().slice(0, 10);

  const [[metrics]] = await db.query(
    `SELECT
       COUNT(*) AS total_today,
       SUM(CASE WHEN status = 'Checked In' THEN 1 ELSE 0 END) AS checked_in,
       SUM(CASE WHEN status = 'Waiting' THEN 1 ELSE 0 END) AS waiting,
       SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status = 'No Show' THEN 1 ELSE 0 END) AS no_shows,
       SUM(CASE WHEN status = 'In Consultation' THEN 1 ELSE 0 END) AS in_consultation
     FROM Appointments
     WHERE appointment_date = ?`,
    [today],
  );

  const [liveQueue] = await db.query(
    `SELECT
       q.queue_position,
       q.board_status,
       q.priority_level,
       q.estimated_wait_minutes,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     JOIN Patients p ON a.national_id = p.national_id
     JOIN Users u ON a.doctor_id = u.user_id
     WHERE a.appointment_date = CURDATE() AND q.board_status NOT IN ('Completed')
     ORDER BY q.queue_position ASC
     LIMIT 10`,
  );

  const [upcoming] = await db.query(
    `SELECT
       a.appointment_id,
       a.appointment_time,
       a.status,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
     FROM Appointments a
     JOIN Patients p ON a.national_id = p.national_id
     JOIN Users u ON a.doctor_id = u.user_id
     WHERE a.appointment_date = CURDATE()
       AND a.status IN ('Scheduled', 'Checked In', 'Waiting')
       AND a.appointment_time >= CURTIME()
     ORDER BY a.appointment_time ASC
     LIMIT 8`,
  );

  const [doctors] = await db.query(
    `SELECT
       u.user_id AS doctor_id,
       CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
       COALESCE(da.status, 'Available') AS status,
       da.workload_count,
       (
         SELECT MIN(CONCAT(a2.appointment_date, ' ', a2.appointment_time))
         FROM Appointments a2
         WHERE a2.doctor_id = u.user_id
           AND a2.appointment_date >= CURDATE()
           AND a2.status = 'Scheduled'
       ) AS next_available
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id AND r.role_name = 'Doctor'
     LEFT JOIN DoctorAvailability da ON da.doctor_id = u.user_id
     WHERE u.is_active = 1
     ORDER BY doctor_name`,
  );

  const [priorityOverview] = await db.query(
    `SELECT
       q.priority_level,
       COUNT(*) AS count
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     WHERE a.appointment_date = CURDATE() AND q.board_status NOT IN ('Completed')
     GROUP BY q.priority_level`,
  );

  const [trendRows] = await db.query(
    `SELECT
       DATE(appointment_date) AS day,
       COUNT(*) AS total
     FROM Appointments
     WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(appointment_date)
     ORDER BY day ASC`,
  );

  const [checkInRows] = await db.query(
    `SELECT
       HOUR(check_in_at) AS hour,
       COUNT(*) AS count
     FROM Appointments
     WHERE appointment_date = CURDATE() AND check_in_at IS NOT NULL
     GROUP BY HOUR(check_in_at)
     ORDER BY hour ASC`,
  );

  const [dailyOps] = await db.query(
    `SELECT status, COUNT(*) AS count
     FROM Appointments
     WHERE appointment_date = CURDATE()
     GROUP BY status`,
  );

  return {
    metrics: {
      total_today: metrics.total_today || 0,
      checked_in: metrics.checked_in || 0,
      waiting: metrics.waiting || 0,
      completed: metrics.completed || 0,
      no_shows: metrics.no_shows || 0,
      in_consultation: metrics.in_consultation || 0,
    },
    live_queue: liveQueue,
    upcoming,
    doctors,
    priority_overview: priorityOverview,
    charts: {
      appointment_trends: trendRows,
      check_in_activity: checkInRows,
      daily_operations: dailyOps,
    },
  };
};

exports.getPriorityOverview = async () => {
  const [rows] = await db.query(
    `SELECT
       q.queue_id,
       q.queue_position,
       q.priority_level,
       q.priority_score,
       q.priority_reason,
       q.board_status,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name
     FROM QueueEntries q
     JOIN Appointments a ON q.appointment_id = a.appointment_id
     JOIN Patients p ON a.national_id = p.national_id
     WHERE a.appointment_date = CURDATE() AND q.board_status NOT IN ('Completed')
     ORDER BY q.queue_position ASC`,
  );
  return { data: rows };
};
