const db = require("../../config/db");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

exports.getSchedule = async (doctorId) => {
  const [rows] = await db.query(
    `SELECT schedule_id, day_of_week, start_time, end_time,
            break_start, break_end, slot_duration_minutes,
            max_appointments, is_active
     FROM doctorschedules
     WHERE doctor_id = ?
     ORDER BY day_of_week`,
    [doctorId],
  );

  const [holidays] = await db.query(
    `SELECT holiday_id, holiday_date, reason
     FROM doctorholidays
     WHERE doctor_id = ? AND holiday_date >= CURDATE()
     ORDER BY holiday_date ASC`,
    [doctorId],
  );

  return {
    days: rows.map((row) => ({
      ...row,
      day_name: DAY_NAMES[row.day_of_week] ?? "Unknown",
    })),
    holidays,
  };
};

exports.saveSchedule = async (doctorId, days = []) => {
  if (!Array.isArray(days)) {
    throw { status: 400, message: "days must be an array" };
  }

  for (const day of days) {
    if (
      day.day_of_week === undefined ||
      !day.start_time ||
      !day.end_time
    ) {
      throw {
        status: 400,
        message: "Each schedule entry requires day_of_week, start_time, and end_time",
      };
    }

    await db.query(
      `INSERT INTO doctorschedules
         (doctor_id, day_of_week, start_time, end_time, break_start, break_end,
          slot_duration_minutes, max_appointments, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         break_start = VALUES(break_start),
         break_end = VALUES(break_end),
         slot_duration_minutes = VALUES(slot_duration_minutes),
         max_appointments = VALUES(max_appointments),
         is_active = VALUES(is_active),
         updated_at = CURRENT_TIMESTAMP`,
      [
        doctorId,
        day.day_of_week,
        day.start_time,
        day.end_time,
        day.break_start || null,
        day.break_end || null,
        day.slot_duration_minutes || 30,
        day.max_appointments || 16,
        day.is_active === false ? 0 : 1,
      ],
    );
  }

  return exports.getSchedule(doctorId);
};

exports.addHoliday = async (doctorId, holiday_date, reason = null) => {
  if (!holiday_date) throw { status: 400, message: "holiday_date is required" };

  await db.query(
    `INSERT INTO doctorholidays (doctor_id, holiday_date, reason)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
    [doctorId, holiday_date, reason],
  );

  return exports.getSchedule(doctorId);
};

exports.removeHoliday = async (doctorId, holidayId) => {
  await db.query(
    `DELETE FROM doctorholidays WHERE holiday_id = ? AND doctor_id = ?`,
    [holidayId, doctorId],
  );
  return { message: "Holiday removed" };
};
