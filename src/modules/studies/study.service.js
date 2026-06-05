const db = require("../../config/db").default;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
// console.log("FILE:", file);
// console.log("PATH:", file.path);
// console.log("EXISTS:", fs.existsSync(file.path));
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);
// const crypto = require("crypto");

// ================= CONVERT AVI TO MP4 =================
function convertToMp4(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.avi$/i, ".mp4");

    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .on("end", () => {
        // امسح الـ AVI الأصلي بعد التحويل
        fs.unlink(inputPath, () => {});
        resolve(outputPath);
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

// ================= UPLOAD IMAGES =================
exports.uploadImages = async (study_id, files, doctor_id, view_type) => {
  if (!files || files.length === 0) {
    throw { status: 400, message: "No images uploaded" };
  }

  if (!view_type) {
    throw { status: 400, message: "view_type is required" };
  }

  // ================= CHECK STUDY =================
  const [study] = await db.query("SELECT 1 FROM Studies WHERE study_id=?", [
    study_id,
  ]);

  if (!study.length) {
    throw { status: 404, message: "Study not found" };
  }

  // ================= VALIDATE DOCTOR =================
  const [doctor] = await db.query(
    `SELECT u.user_id
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.user_id=? 
       AND r.role_name='Doctor'
       AND u.is_active=1`,
    [doctor_id],
  );

  if (!doctor.length) {
    throw { status: 403, message: "Invalid or inactive doctor" };
  }

  // ================= INSERT IMAGES =================
  const filePaths = [];

  await Promise.all(
    files.map(async (file) => {
      let filePath = file.path || file.filename;
      let mimeType = file.mimetype || "application/octet-stream";

      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".avi") {
        try {
          filePath = await convertToMp4(filePath);
          mimeType = "video/mp4";
        } catch (err) {
          console.error("AVI conversion failed:", err.message);
        }
      }
      await db.query(
        `INSERT INTO Images 
        (study_id, view_type, file_path, file_format, uploaded_by)
        VALUES (?, ?, ?, ?, ?)`,
        [study_id, view_type, filePath, mimeType, doctor_id],
      );

      filePaths.push(filePath);
    }),
  );

  // Mark study as viewed once media is uploaded
  await db.query(
    `UPDATE Studies
     SET status = 'Viewed'
     WHERE study_id = ?
       AND status IN ('Scheduled', 'Pending', 'In Progress')`,
    [study_id],
  );

  // ================= RESPONSE =================
  return {
    success: true,
    message: "Upload completed successfully",
    study_id,
    count: files.length,
    files: filePaths,
    metadata: {
      uploaded_by: doctor_id,
      view_type,
    },
  };
};
// // ================= UPLOAD IMAGES =================

// exports.uploadImages = async (study_id, files, doctor_id) => {

//   if (!files || files.length === 0) {
//     throw { status: 400, message: "No images uploaded" };
//   }

//   // ================= CHECK STUDY =================
//   const [study] = await db.query(
//     "SELECT 1 FROM Studies WHERE study_id=?",
//     [study_id]
//   );

//   if (!study.length) {
//     throw { status: 404, message: "Study not found" };
//   }

//   // ================= VALIDATE DOCTOR =================
//   const [doctor] = await db.query(
//     `SELECT u.user_id
//      FROM Users u
//      JOIN Roles r ON u.role_id = r.role_id
//      WHERE u.user_id=?
//        AND r.role_name='Doctor'
//        AND u.is_active=1`,
//     [doctor_id]
//   );

//   if (!doctor.length) {
//     throw { status: 403, message: "Invalid or inactive doctor" };
//   }

//   // ================= INSERT IMAGES =================
//   await Promise.all(
//     files.map(file =>
//       db.query(
//         `INSERT INTO Images (study_id, file_path, file_format, uploaded_by)
//          VALUES (?, ?, ?, ?)`,
//         [study_id, file.path || file.filename, file.mimetype || "DICOM", doctor_id]
//       )
//     )
//   );

//   return { message: "Images uploaded successfully" };
// };

// ================= COMPLETE STUDY =================
exports.completeStudy = async (study_id, doctor_id) => {
  // ================= 1. CHECK STUDY =================
  const [study] = await db.query(
    "SELECT status FROM Studies WHERE study_id=?",
    [study_id],
  );

  if (!study.length) {
    throw { status: 404, message: "Study not found" };
  }

  if (study[0].status === "Completed") {
    throw { status: 400, message: "Study already completed" };
  }

  // ================= 2. VALIDATE DOCTOR =================
  const [doctor] = await db.query(
    `SELECT u.user_id 
     FROM Users u
     JOIN Roles r ON u.role_id = r.role_id
     WHERE u.user_id=? 
       AND r.role_name='Doctor'
       AND u.is_active=1`,
    [doctor_id],
  );

  if (!doctor.length) {
    throw { status: 403, message: "Invalid or inactive doctor" };
  }

  // ================= 3. CHECK REPORT =================
  const [report] = await db.query(
    `SELECT report_status 
     FROM Reports 
     WHERE study_id=?`,
    [study_id],
  );

  if (!report.length) {
    throw { status: 400, message: "Report must be created first" };
  }

  if (report[0].report_status !== "Signed") {
    throw {
      status: 400,
      message: "Report must be signed before completing study",
    };
  }

  // ================= 4. COMPLETE STUDY =================
  await db.query(
    `UPDATE Studies 
     SET status='Completed'
     WHERE study_id=?`,
    [study_id],
  );

  return { message: "Study completed successfully" };
};

// ================= SAVE STUDY NOTES [created by farah] =================
exports.saveStudyNotes = async (
  study_id,
  note_text,
  doctor_name,
  note_id = null,
) => {
  if (!note_text || !note_text.trim()) {
    throw { status: 400, message: "Note text is required" };
  }

  const [study] = await db.query(
    `SELECT study_id, notes FROM Studies WHERE study_id = ?`,
    [study_id],
  );

  if (!study.length) {
    throw { status: 404, message: "Study not found" };
  }

  let existing = [];

  try {
    existing = study[0].notes ? JSON.parse(study[0].notes) : [];
  } catch {
    existing = [];
  }

  // ================= UPDATE =================
  const existingIndex = existing.findIndex((note) => note.id === note_id);

  if (existingIndex !== -1) {
    existing[existingIndex] = {
      ...existing[existingIndex],
      text: note_text,
      edited_at: new Date().toISOString(),
    };
  }

  // ================= CREATE =================
  else {
    existing.push({
      id: crypto.randomUUID(),

      text: note_text,

      doctor: doctor_name,

      created_at: new Date().toISOString(),

      edited_at: null,
    });
  }

  await db.query(`UPDATE Studies SET notes = ? WHERE study_id = ?`, [
    JSON.stringify(existing),
    study_id,
  ]);

  return {
    success: true,

    message:
      existingIndex !== -1
        ? "Note updated successfully"
        : "Note added successfully",

    notes: existing,
  };
};

// ================= DELETE STUDY NOTE =================
exports.deleteStudyNote = async (study_id, note_id) => {
  const [study] = await db.query(
    `SELECT notes FROM Studies WHERE study_id = ?`,
    [study_id],
  );

  if (!study.length) {
    throw { status: 404, message: "Study not found" };
  }

  let notes = [];

  try {
    notes = study[0].notes ? JSON.parse(study[0].notes) : [];
  } catch {
    notes = [];
  }

  const filtered = notes.filter((note) => note.id !== note_id);

  if (filtered.length === notes.length) {
    throw { status: 404, message: "Note not found" };
  }

  await db.query(`UPDATE Studies SET notes = ? WHERE study_id = ?`, [
    JSON.stringify(filtered),
    study_id,
  ]);

  return {
    success: true,
    message: "Note deleted successfully",
    notes: filtered,
  };
};


// ================= DELETE IMAGE [created by farah] =================
exports.deleteImage = async (study_id, image_id, doctor_id) => {
  const [image] = await db.query(
    `SELECT i.image_id, i.file_path
     FROM Images i
     JOIN Studies s ON i.study_id = s.study_id
     JOIN Patients p ON s.national_id = p.national_id
     WHERE i.image_id = ?
       AND i.study_id = ?
       AND p.doctor_id = ?`,
    [image_id, study_id, doctor_id]
  );

  if (!image.length) {
    throw { status: 404, message: "Image not found or access denied" };
  }

  const filePath = image[0].file_path;

  await db.query(`DELETE FROM Images WHERE image_id = ?`, [image_id]);

  if (filePath && fs.existsSync(path.resolve(filePath))) {
    fs.unlink(path.resolve(filePath), () => {});
  }

  return { message: "Image deleted successfully" };
};