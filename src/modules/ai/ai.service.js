const db = require("../../config/db");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

// const { getDiagnosis } = require("./ai.service"); 
// ==========================================
// FILE TYPE DETECTOR
// ==========================================
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if ([".mp4", ".avi", ".mov", ".mkv", ".wmv"].includes(ext)) {
    return "video";
  }

  if ([".dcm", ".dicom", ".nii", ".mhd"].includes(ext)) {
    return "dicom";
  }

  return "unknown";
}

// ==========================================
// DISEASE CLASSIFICATION
// ==========================================
function getDiagnosis(result) {
  const hasHF = Number(result.has_hfref) === 1;
  const hasLVH = Number(result.has_lvh) === 1;

  if (!hasHF && !hasLVH) {
    return {
      diagnosis: "Normal",
      summary: "No Heart Failure or LVH detected",
    };
  }

  if (hasHF && !hasLVH) {
    return {
      diagnosis: "Heart Failure",
      summary: "Heart Failure detected",
    };
  }

  if (!hasHF && hasLVH) {
    return {
      diagnosis: "LVH",
      summary: "Left Ventricular Hypertrophy detected",
    };
  }

  return {
    diagnosis: "Heart Failure + LVH",
    summary: "Both Heart Failure and LVH detected",
  };
}
exports.getDiagnosis = getDiagnosis;

// ==========================================
// RUN AI ANALYSIS
// ==========================================
exports.runAIAnalysis = async (study_id, image_id = null) => {
  // added image_id
  try {
    console.log("🔥 RUN AI START:", study_id);

    // ======================================
    // 1. GET STUDY
    // ======================================

    // added image_id by farah
    //   const query = image_id
    //   ? "SELECT file_path FROM Images WHERE study_id = ? AND image_id = ? LIMIT 1"
    //   : "SELECT file_path FROM Images WHERE study_id = ? LIMIT 1";

    // const params = image_id ? [study_id, image_id] : [study_id];
    // const [imageRows] = await db.query(query, params);
    // endded added image_id by farah

    //
    const [studyRows] = await db.query(
      "SELECT * FROM studies WHERE study_id = ?",
      [study_id],
    );

    if (!studyRows.length) {
      return {
        message: "Study not found",
        data: null,
      };
    }

    const study = studyRows[0];

    if (study.study_type !== "Echo") {
      return {
        message: "Only Echo supported",
        data: null,
      };
    }

    // ======================================
    // 2. GET FILE [edited by farah]
    // ======================================
    const imageQuery = image_id
      ? "SELECT file_path FROM Images WHERE study_id = ? AND image_id = ? LIMIT 1"
      : "SELECT file_path FROM Images WHERE study_id = ? LIMIT 1";

    const imageParams = image_id ? [study_id, image_id] : [study_id];
    const [imageRows] = await db.query(imageQuery, imageParams);

    if (!imageRows.length || !imageRows[0].file_path) {
      return { message: "No file found", data: null };
    }

    let filePath = path.resolve(imageRows[0].file_path);
    const fileType = getFileType(filePath);

    if (fileType !== "video") {
      throw {
        status: 422,
        message: "AI analysis supports video files only. Images can be uploaded and viewed but cannot be analyzed.",
      };
    }

    if (!fs.existsSync(filePath)) {
      return {
        message: "File not found on disk",
        data: null,
      };
    }

    // ======================================
    // 3. DETECT FILE TYPE
    // ======================================
    if (fileType === "unknown") {
      return {
        message: "Unsupported file type",
        data: null,
      };
    }

    console.log("📂 FILE:", filePath);
    console.log("📦 TYPE:", fileType);

    // ======================================
    // 4. CALL AI SERVICE
    // ======================================
    const response = await axios.post(
      "http://localhost:5000/analyze",
      {
        file_path: filePath,
        file_type: fileType,
      },
      {
        timeout: 120000,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = response.data;

    if (!result || result.success === false) {
      return {
        message: result?.error || "AI failed",
        data: null,
      };
    }

    console.log("✅ RAW AI RESULT:", result);

    // ======================================
    // 5. CLASSIFY RESULT
    // ======================================
    const classification = getDiagnosis(result);

    console.log("🩺 Diagnosis:", classification.diagnosis);

    // ======================================
    // 6. STORE RESULT
    // ======================================
    await db.query(
      `
      INSERT INTO ai_results (
        study_id,
        ejection_fraction,
        wall_thickness,
        has_hfref,
        has_lvh,
        hfref_confidence,
        lvh_confidence
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)

      ON DUPLICATE KEY UPDATE
        ejection_fraction = VALUES(ejection_fraction),
        wall_thickness = VALUES(wall_thickness),
        has_hfref = VALUES(has_hfref),
        has_lvh = VALUES(has_lvh),
        hfref_confidence = VALUES(hfref_confidence),
        lvh_confidence = VALUES(lvh_confidence)
      `,
      [
        study_id,
        result.ejection_fraction,
        result.wall_thickness,
        result.has_hfref,
        result.has_lvh,
        result.hfref_confidence,
        result.lvh_confidence,
      ],
    );

    // ======================================
    // 7. VALIDATION TABLE
    // ======================================
    await db.query(
      `
      INSERT INTO ai_validation (study_id, status, validated_by, validated_at)
      VALUES (?, 'Pending', NULL, NULL)
      ON DUPLICATE KEY UPDATE
        status = 'Pending',
        validated_by = NULL,
        validated_at = NULL
      `,
      [study_id],
    );

    // ======================================
    // 8. FINAL RESPONSE TO DOCTOR
    // ======================================
    return {
      message: "AI completed successfully",

      data: {
        ...result,

        diagnosis: classification.diagnosis,
        summary: classification.summary,
      },
    };
  } catch (err) {
    console.error("🔥 AI ERROR:", err.message);

    return {
      message: "AI service failed",
      data: null,
      error: err.message,
    };
  }
};

// ================= VALIDATE AI =================
exports.validateAI = async (study_id, doctor_id, action) => {
  const [rows] = await db.query(
    "SELECT * FROM ai_validation WHERE study_id=?",
    [study_id],
  );

  if (!rows.length) {
    throw { status: 404, message: "No validation record found" };
  }

  const current = rows[0];

  // ================= APPROVE =================
  if (action === "approve") {
    if (current.status === "Approved") {
      return { message: "AI already approved" };
    }

    await db.query(
      `UPDATE ai_validation
       SET status='Approved',
           validated_by=?,
           validated_at=NOW()
       WHERE study_id=?`,
      [doctor_id, study_id],
    );

    return { message: "AI approved successfully" };
  }

  // ================= REJECT =================
  if (action === "reject") {
    if (current.status === "Rejected") {
      return { message: "AI already rejected" };
    }

    await db.query(
      `UPDATE ai_validation
       SET status='Rejected',
           validated_by=?,
           validated_at=NOW()
       WHERE study_id=?`,
      [doctor_id, study_id],
    );

    return { message: "AI rejected successfully" };
  }

  throw { status: 400, message: "Invalid action" };
};

// // ================= EDIT AI RESULT =================
exports.editAIResult = async (study_id, doctor_id, edits) => {
  // ================= CHECK AI RESULT =================
  const [aiRows] = await db.query(
    `SELECT * 
     FROM ai_results 
     WHERE study_id=?`,
    [study_id],
  );

  if (!aiRows.length) {
    throw {
      status: 404,
      message: "AI result not found",
    };
  }

  // ================= CHECK VALIDATION =================
  const [validationRows] = await db.query(
    `SELECT status
     FROM ai_validation
     WHERE study_id=?`,
    [study_id],
  );

  if (!validationRows.length) {
    throw {
      status: 404,
      message: "Validation record not found",
    };
  }

  const status = validationRows[0].status?.trim()?.toLowerCase();

  console.log("Current validation status:", status);

  // ================= BLOCK APPROVED =================
  if (status === "approved") {
    throw {
      status: 403,
      message: "Approved AI result cannot be edited",
    };
  }

  const ai = aiRows[0];

  const allowedFields = [
    "ejection_fraction",
    "wall_thickness",
    "has_hfref",
    "has_lvh",
    "hfref_confidence",
    "lvh_confidence",
  ];

  let changed = false;

  // ================= EMPTY BODY CHECK =================
  const validEditKeys = Object.keys(edits).filter((key) =>
    allowedFields.includes(key),
  );

  if (!validEditKeys.length) {
    throw {
      status: 400,
      message: "No valid editable fields provided",
    };
  }

  // ================= APPLY CHANGES =================
  for (const key of validEditKeys) {
    const oldValue = ai[key];
    const newValue = edits[key];

    if (String(oldValue) === String(newValue)) {
      continue;
    }

    changed = true;

    // Audit log
    await db.query(
      `INSERT INTO ai_edits
      (
        study_id,
        field_name,
        old_value,
        new_value,
        edited_by
      )
      VALUES (?,?,?,?,?)`,
      [study_id, key, oldValue, newValue, doctor_id],
    );

    // Update field
    await db.query(
      `UPDATE ai_results
       SET ${key}=?
       WHERE study_id=?`,
      [newValue, study_id],
    );
  }

  // ================= NO CHANGE =================
  if (!changed) {
    return {
      message: "No changes detected",
      data: ai,
    };
  }

  // ================= UPDATE VALIDATION =================
  await db.query(
    `UPDATE ai_validation
     SET status='Edited',
         validated_by=?,
         validated_at=NOW()
     WHERE study_id=?`,
    [doctor_id, study_id],
  );

  // ================= GET UPDATED RESULT =================
  const [updatedRows] = await db.query(
    `SELECT *
     FROM ai_results
     WHERE study_id=?`,
    [study_id],
  );

  return {
    message: "AI updated successfully. Please approve final result.",
    data: updatedRows[0],
  };
};
