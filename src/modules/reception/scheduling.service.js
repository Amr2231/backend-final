const db = require("../../config/db");

function parseTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function addMinutes(timeStr, mins) {
  return formatTime(parseTime(timeStr) + mins);
}

exports.suggestSlots = async ({
  doctor_id,
  national_id,
  date,
  duration_minutes = 30,
}) => {
  if (!doctor_id || !date) {
    throw { status: 400, message: "doctor_id and date are required" };
  }

  const dateOnly = String(date).includes("T")
    ? String(date).slice(0, 10)
    : String(date).slice(0, 10);
  date = dateOnly;

  const targetDate = new Date(`${dateOnly}T12:00:00`);
  const dayOfWeek = targetDate.getDay();

  const [holiday] = await db.query(
    `SELECT 1 FROM DoctorHolidays WHERE doctor_id = ? AND holiday_date = ?`,
    [doctor_id, date],
  );
  if (holiday.length) {
    return {
      suggestions: [],
      warnings: [{ type: "holiday", message: "Doctor is on leave for this date" }],
    };
  }

  const [schedule] = await db.query(
    `SELECT * FROM DoctorSchedules
     WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1`,
    [doctor_id, dayOfWeek],
  );
  if (!schedule.length) {
    return {
      suggestions: [],
      warnings: [{ type: "no_schedule", message: "Doctor does not work on this day" }],
    };
  }

  const sched = schedule[0];
  const workStart = parseTime(String(sched.start_time).slice(0, 5));
  const workEnd = parseTime(String(sched.end_time).slice(0, 5));
  const breakStart = sched.break_start ? parseTime(String(sched.break_start).slice(0, 5)) : null;
  const breakEnd = sched.break_end ? parseTime(String(sched.break_end).slice(0, 5)) : null;

  const [existing] = await db.query(
    `SELECT appointment_time, duration_minutes FROM Appointments
     WHERE doctor_id = ? AND appointment_date = ?
       AND status NOT IN ('Cancelled', 'No Show')`,
    [doctor_id, date],
  );

  const [doctorName] = await db.query(
    `SELECT CONCAT(first_name,' ',last_name) AS name FROM Users WHERE user_id = ?`,
    [doctor_id],
  );

  const booked = existing.map((a) => ({
    start: parseTime(String(a.appointment_time).slice(0, 5)),
    end: parseTime(String(a.appointment_time).slice(0, 5)) + (a.duration_minutes || 30),
  }));

  const slotDuration = duration_minutes;
  const suggestions = [];
  const warnings = [];

  for (let start = workStart; start + slotDuration <= workEnd; start += 15) {
    const end = start + slotDuration;

    if (breakStart !== null && breakEnd !== null) {
      if (start < breakEnd && end > breakStart) continue;
    }

    const conflict = booked.find((b) => start < b.end && end > b.start);
    if (conflict) continue;

    const timeStr = formatTime(start);
    const reasons = [];
    reasons.push(`Within working hours (${String(sched.start_time).slice(0, 5)}–${String(sched.end_time).slice(0, 5)})`);
    if (breakStart !== null) {
      reasons.push(`Outside break window (${String(sched.break_start).slice(0, 5)}–${String(sched.break_end).slice(0, 5)})`);
    }
    reasons.push("No scheduling conflicts detected");

    const nearbyCount = booked.filter(
      (b) => Math.abs(b.start - start) <= 60,
    ).length;
    if (nearbyCount >= 3) {
      warnings.push({
        type: "overbooking",
        message: `High density around ${timeStr.slice(0, 5)} — ${nearbyCount} nearby appointments`,
        time: timeStr,
      });
    }

    let score = 100 - nearbyCount * 10;
    if (start >= workStart + 60 && start <= workEnd - 120) score += 10;

    suggestions.push({
      appointment_time: timeStr,
      score,
      reasons,
      doctor_id,
      doctor_name: doctorName[0]?.name,
      duration_minutes: slotDuration,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);

  if (national_id) {
    const [patientAppts] = await db.query(
      `SELECT appointment_date, appointment_time FROM Appointments
       WHERE national_id = ? AND appointment_date = ?
         AND status NOT IN ('Cancelled', 'No Show', 'Completed')`,
      [national_id, date],
    );
    if (patientAppts.length) {
      warnings.push({
        type: "patient_conflict",
        message: "Patient already has an appointment on this date",
      });
    }
  }

  const alternatives = [];
  if (suggestions.length < 3) {
    for (let d = 1; d <= 3; d++) {
      const altDate = new Date(targetDate);
      altDate.setDate(altDate.getDate() + d);
      const altDateStr = altDate.toISOString().slice(0, 10);
      const alt = await exports.suggestSlots({
        doctor_id,
        date: altDateStr,
        duration_minutes,
      });
      if (alt.suggestions.length) {
        alternatives.push({
          date: altDateStr,
          top_slot: alt.suggestions[0],
        });
      }
    }
  }

  return {
    date,
    doctor_id,
    suggestions: suggestions.slice(0, 8),
    warnings,
    alternatives,
  };
};

exports.checkConflict = async ({ doctor_id, appointment_date, appointment_time, duration_minutes = 30, exclude_id }) => {
  let sql = `
    SELECT a.*, CONCAT(p.first_name,' ',p.last_name) AS patient_name
    FROM Appointments a
    JOIN Patients p ON a.national_id = p.national_id
    WHERE a.doctor_id = ? AND a.appointment_date = ?
      AND a.status NOT IN ('Cancelled', 'No Show', 'Completed')`;
  const params = [doctor_id, appointment_date];

  if (exclude_id) {
    sql += " AND a.appointment_id != ?";
    params.push(exclude_id);
  }

  const [rows] = await db.query(sql, params);
  const newStart = parseTime(String(appointment_time).slice(0, 5));
  const newEnd = newStart + duration_minutes;

  const conflicts = rows.filter((a) => {
    const start = parseTime(String(a.appointment_time).slice(0, 5));
    const end = start + (a.duration_minutes || 30);
    return newStart < end && newEnd > start;
  });

  return { has_conflict: conflicts.length > 0, conflicts };
};
