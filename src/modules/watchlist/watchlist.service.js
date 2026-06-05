// ================= created by farah =================
const db = require("../../config/db").default;

// ================= ADD TO WATCHLIST =================
exports.addToWatchlist = async (
  doctor_id,
  national_id,
  note = "",
  priority = "monitor",
) => {
  const [patient] = await db.query(
    `SELECT national_id, first_name, last_name FROM Patients WHERE national_id = ? AND is_active = 1`,
    [national_id],
  );
  if (!patient.length) throw { status: 404, message: "Patient not found" };

  const [exists] = await db.query(
    `SELECT id FROM Watchlist WHERE doctor_id = ? AND national_id = ?`,
    [doctor_id, national_id],
  );
  if (exists.length)
    throw { status: 409, message: "Patient already in watchlist" };

  await db.query(
    `INSERT INTO Watchlist (doctor_id, national_id, note, priority) VALUES (?, ?, ?, ?)`,
    [doctor_id, national_id, note, priority],
  );

  return { message: "Added to watchlist successfully" };
};

// ================= REMOVE FROM WATCHLIST =================
exports.removeFromWatchlist = async (doctor_id, national_id) => {
  const [row] = await db.query(
    `SELECT id FROM Watchlist WHERE doctor_id = ? AND national_id = ?`,
    [doctor_id, national_id],
  );
  if (!row.length) throw { status: 404, message: "Not found in watchlist" };

  await db.query(
    `DELETE FROM Watchlist WHERE doctor_id = ? AND national_id = ?`,
    [doctor_id, national_id],
  );

  return { message: "Removed from watchlist" };
};

// ================= GET WATCHLIST =================
exports.getWatchlist = async (doctor_id) => {
  const [rows] = await db.query(
    `SELECT
       w.id,
       w.national_id,
       w.note,
       w.priority,
       w.created_at,
       p.first_name,
       p.last_name,
       s.study_id,
       s.study_type,
       s.notes AS study_notes,
       s.status AS study_status,
       r.report_status,
       ai.ejection_fraction,
       ai.has_hfref,
       ai.has_lvh
     FROM Watchlist w
     JOIN Patients p ON w.national_id = p.national_id
     LEFT JOIN Studies s ON p.national_id = s.national_id
       AND s.study_id = (
         SELECT study_id FROM Studies
         WHERE national_id = p.national_id
         ORDER BY study_date DESC LIMIT 1
       )
     LEFT JOIN Reports r ON r.study_id = s.study_id
     LEFT JOIN AI_Results ai ON ai.study_id = s.study_id
     WHERE w.doctor_id = ?
     ORDER BY
       FIELD(w.priority,'critical','monitor','stable'),
       w.created_at DESC`,
    [doctor_id],
  );

  const data = rows.map((row) => {
    let latest_study_note = null;
    if (row.study_notes) {
      try {
        const notes = JSON.parse(row.study_notes);
        if (Array.isArray(notes) && notes.length) {
          const sorted = [...notes].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
          latest_study_note = sorted[0]?.text ?? null;
        }
      } catch {
        latest_study_note = null;
      }
    }
    const { study_notes, ...rest } = row;
    return { ...rest, latest_study_note };
  });

  return { count: data.length, data };
};

// ================= UPDATE WATCHLIST NOTE/PRIORITY =================
exports.updateWatchlistItem = async (
  doctor_id,
  national_id,
  note,
  priority,
) => {
  const [row] = await db.query(
    `SELECT id FROM Watchlist WHERE doctor_id = ? AND national_id = ?`,
    [doctor_id, national_id],
  );
  if (!row.length) throw { status: 404, message: "Not found in watchlist" };

  await db.query(
    `UPDATE Watchlist SET note = ?, priority = ? WHERE doctor_id = ? AND national_id = ?`,
    [note, priority, doctor_id, national_id],
  );

  return { message: "Watchlist item updated" };
};
