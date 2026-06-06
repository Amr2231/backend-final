const db = require("../../config/db");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// ======================================================
// HELPERS
// ======================================================
function getEFInterpretation(ef) {
  if (ef >= 55) return "Normal left ventricular systolic function preserved.";
  if (ef >= 40) return "Mildly reduced left ventricular systolic function.";
  return "Reduced left ventricular systolic function.";
}

function getDetectedDiseases(ai) {
  const diseases = [];

  if (ai.has_hfref) {
    diseases.push("Heart Failure with Reduced Ejection Fraction (HFrEF)");
  }

  if (ai.has_lvh) {
    diseases.push("Left Ventricular Hypertrophy (LVH)");
  }

  return diseases;
}

// ======================================================
// AI REPORT BUILDER (CLINICAL ONLY)
// ======================================================
function buildMedicalAISection(ai, doctorInterpretation = "") {
  const ef = Number(ai.ejection_fraction || 0);
  const wall = Number(ai.wall_thickness || 0);

  const diseases = getDetectedDiseases(ai);

  const efText = `${ef}%                       (Normal Range: 55% - 70%)`;

  const diseaseText =
    diseases.length === 0
      ? "No AI-detected evidence of HFrEF or LVH."
      : diseases.map((x) => `• ${x}`).join("\n");

  return `

Measurements:
• Left Ventricular Ejection Fraction (LVEF): ${efText}
• Ventricular Wall Thickness: ${wall} mm

Detected Conditions:
${diseaseText}

Clinical Impression:
${
  diseases.length === 0
    ? "No significant systolic or structural abnormality detected."
    : "Abnormal cardiac findings identified. Clinical correlation is recommended."
}

Physician Interpretation:
${doctorInterpretation || "Pending physician interpretation."}


`;
}
// ======================================================
// OPEN REPORT
// ASSIGNED DOCTOR = FROM PATIENT
// ======================================================

exports.openReport = async (study_id) => {
  // ================= CHECK STUDY =================
  const [studyRows] = await db.query(
    `
    SELECT 
      s.study_id,
      p.doctor_id
    FROM studies s
    JOIN patients p 
      ON s.national_id = p.national_id
    WHERE s.study_id = ?
    `,
    [study_id],
  );

  if (!studyRows.length) {
    throw {
      status: 404,
      message: "Study not found",
    };
  }

  const assignedDoctorId = studyRows[0].doctor_id;

  // ======================================================
  // CHECK IMAGES EXIST
  // ======================================================
  // const [images] = await db.query(
  //   `
  //   SELECT image_id
  //   FROM Images
  //   WHERE study_id = ?
  //   `,
  //   [study_id],
  // );

  // if (!images.length) {
  //   throw {
  //     status: 400,
  //     message: "Cannot open report before uploading study images",
  //   };
  // }

  // ======================================================
  // CHECK EXISTING REPORT
  // ======================================================
  const [existing] = await db.query(
    `
    SELECT *
    FROM Reports
    WHERE study_id = ?
    `,
    [study_id],
  );

  // ======================================================
  // CREATE REPORT
  // ======================================================
  if (!existing.length) {
    await db.query(
      `
      INSERT INTO Reports
      (
        study_id,
        doctor_id,
        report_status,
        report_content
      )
      VALUES (?, ?, 'Written', '')
      `,
      [study_id, assignedDoctorId],
    );
    // UPDATE STUDY [created by farah]
    await db.query(`UPDATE studies SET status='In Progress' WHERE study_id=?`, [
      study_id,
    ]);
  }

  // ======================================================
  // RETURN REPORT
  // ======================================================
  const [report] = await db.query(
    `
    SELECT *
    FROM Reports
    WHERE study_id = ?
    `,
    [study_id],
  );

  return report[0];
};

// ======================================================
// AUTO SAVE (DOCTOR INTERPRETATION)
// ======================================================
exports.autoSaveReport = async (study_id, content) => {
  const [rows] = await db.query(`SELECT * FROM Reports WHERE study_id=?`, [
    study_id,
  ]);

  if (!rows.length) {
    const [studyRows] = await db.query(
      `SELECT p.doctor_id FROM studies s
       JOIN patients p ON s.national_id = p.national_id
       WHERE s.study_id = ?`,
      [study_id],
    );
    if (!studyRows.length) {
      throw { status: 404, message: "Study not found" };
    }
    await db.query(
      `INSERT INTO Reports (study_id, doctor_id, report_status, report_content)
       VALUES (?, ?, 'Written', ?)`,
      [study_id, studyRows[0].doctor_id, content],
    );

    // ================= UPDATE STUDY STATUS [created by farah] =================
    await db.query(`UPDATE studies SET status='In Progress' WHERE study_id=?`, [
      study_id,
    ]);
    return { message: "Report created and saved" };
  }

  if (rows[0].report_status === "Signed") {
    throw { status: 400, message: "Cannot edit finalized report" };
  }

  await db.query(`UPDATE Reports SET report_content=? WHERE study_id=?`, [
    content,
    study_id,
  ]);

  // ================= UPDATE STUDY STATUS [created by farah] =================
  await db.query(`UPDATE studies SET status='In Progress' WHERE study_id=?`, [
    study_id,
  ]);

  return { message: "Auto-saved successfully" };
};

// ======================================================
// INSERT AI FINDINGS (NO ASSIGNMENT CHANGE)
// ======================================================
// ======================================================
// INSERT AI FINDINGS
// ======================================================
exports.insertAIFindings = async (
  study_id,
  loggedInDoctorId,
  doctorInterpretation = "",
) => {
  // ================= AI RESULTS =================
  const [aiRows] = await db.query(`SELECT * FROM ai_Results WHERE study_id=?`, [
    study_id,
  ]);

  if (!aiRows.length) {
    throw { status: 404, message: "AI results not found" };
  }

  const ai = aiRows[0];

  // ================= AI VALIDATION =================
  const [valRows] = await db.query(
    `SELECT * FROM AI_Validation WHERE study_id=?`,
    [study_id],
  );

  if (!valRows.length || valRows[0].status !== "Approved") {
    throw {
      status: 400,
      message: "AI must be approved first",
    };
  }

  // ================= GET ASSIGNED DOCTOR =================
  const [studyRows] = await db.query(
    `
    SELECT 
      p.doctor_id
    FROM studies s
    JOIN patients p
      ON s.national_id = p.national_id
    WHERE s.study_id=?
    `,
    [study_id],
  );

  if (!studyRows.length) {
    throw { status: 404, message: "Study not found" };
  }

  const assignedDoctorId = studyRows[0].doctor_id;

  // ================= CHECK REPORT =================
  const [reportRows] = await db.query(
    `SELECT * FROM Reports WHERE study_id=?`,
    [study_id],
  );

  // ================= CREATE REPORT =================
  if (!reportRows.length) {
    await db.query(
      `
      INSERT INTO Reports
      (
        study_id,
        doctor_id,
        report_status,
        report_content
      )
      VALUES (?, ?, 'Written', '')
      `,
      [study_id, assignedDoctorId],
    );
  }

  // ================= BUILD REPORT =================
  const reportText = buildMedicalAISection(ai, doctorInterpretation);

  // ================= UPDATE REPORT =================
  await db.query(
    `
    UPDATE Reports
    SET report_content=?
    WHERE study_id=?
    `,
    [reportText, study_id],
  );

  return {
    message: "AI report generated successfully",
  };
};

// ======================================================
// FINALIZE REPORT [edit by farah] (SIGNED BY DOCTOR)
// ======================================================
exports.finalizeReport = async (study_id, doctor_id) => {
  const [rows] = await db.query(`SELECT * FROM Reports WHERE study_id=?`, [
    study_id,
  ]);

  if (!rows.length) throw { status: 404, message: "Report not found" };

  const report = rows[0];

  if (report.report_status === "Signed") {
    throw { status: 400, message: "Already finalized" };
  }

  if (!report.report_content?.trim()) {
    throw { status: 400, message: "Empty report" };
  }

  // ================= SIGN REPORT =================
  await db.query(
    `UPDATE Reports
     SET report_status='Signed',
         signed_at=NOW(),
         signed_by=?
     WHERE study_id=?`,
    [doctor_id, study_id],
  );

  // ================= AUTO COMPLETE STUDY =================
  await db.query(
    `UPDATE studies
     SET status='Completed'
     WHERE study_id=?`,
    [study_id],
  );

  return { message: "Report finalized and study completed successfully" };
};

// ======================================================
// GET REPORT (ASSIGNED + SIGNED DOCTOR)
// ======================================================
exports.getReport = async (study_id) => {
  const [rows] = await db.query(
    `
    SELECT
      r.*,
      p.first_name AS patient_first_name,
      p.last_name AS patient_last_name,
      s.study_type,
      s.study_date,

      CONCAT(u.first_name,' ',u.last_name) AS assigned_doctor,
      CONCAT(u2.first_name,' ',u2.last_name) AS signing_doctor

    FROM Reports r
    JOIN studies s ON r.study_id = s.study_id
    JOIN patients p ON s.national_id = p.national_id
    LEFT JOIN users u ON r.doctor_id = u.user_id
    LEFT JOIN users u2 ON r.signed_by = u2.user_id
    WHERE r.study_id=?
    `,
    [study_id],
  );

  if (!rows.length) throw { status: 404, message: "Report not found" };

  return rows[0];
};

// ======================================================
// EXPORT PDF
// ======================================================
exports.exportReport = async (study_id) => {
  const report = await exports.getReport(study_id);

  if (report.report_status !== "Signed") {
    throw { status: 400, message: "Finalize report first" };
  }

  const dir = path.join(__dirname, "../../uploads/reports");
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `report_${study_id}.pdf`;
  const filePath = path.join(dir, fileName);

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  doc.pipe(fs.createWriteStream(filePath));

  const W = 595,
    H = 842;

  // ── Palette ─────────────────────────────────────────
  const NAVY = "#0d2547";
  const CYAN = "#00bcd4";
  const BLUE = "#1565c0";
  const BLUE_LIGHT = "#2979c8";
  const OFFWHITE = "#f5f7fa";
  const ROW_ALT = "#eef2f8";
  const BORDER = "#d0d9e8";
  const DARK = "#1a2741";
  const MID = "#5a6a85";
  const TABLE_HEAD = "#1e3a6e";
  const TEXT_BLUE = "#1a6fc4";

  // ── Dates ────────────────────────────────────────────
  const studyDateStr = report.study_date
    ? new Date(report.study_date).toISOString().split("T")[0]
    : "N/A";
  const reportDateStr = new Date().toISOString().split("T")[0];
  const signedAtStr = report.signed_at
    ? new Date(report.signed_at).toISOString().replace("T", " ").split(".")[0]
    : "N/A";

  // ── Helpers ──────────────────────────────────────────
  function hRule(x, y, w, color = BORDER) {
    doc
      .save()
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineWidth(0.5)
      .strokeColor(color)
      .stroke()
      .restore();
  }

  function infoRow(y, col1L, col1V, col2L, col2V, shade) {
    const rowH = 27,
      startX = 44,
      rowW = W - 88;
    if (shade) doc.rect(startX, y, rowW, rowH).fill(ROW_ALT);
    doc
      .fillColor(TABLE_HEAD)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(col1L, startX + 12, y + 9, { width: 110 });
    doc
      .fillColor(DARK)
      .font("Helvetica")
      .fontSize(8.5)
      .text(col1V, startX + 120, y + 9, { width: 160 });
    doc
      .fillColor(TABLE_HEAD)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(col2L, startX + 318, y + 9, { width: 90 });
    doc
      .fillColor(DARK)
      .font("Helvetica")
      .fontSize(8.5)
      .text(col2V, startX + 415, y + 9, { width: 130 });
  }

  // ════════════════════════════════════════════════════
  // 1. HEADER
  // ════════════════════════════════════════════════════
  doc.rect(0, 0, W, 108).fill(NAVY);

  // NRC circle logo
  doc.circle(66, 54, 36).fill("#1a3a6e").stroke(CYAN);
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("NRC", 48, 46, { width: 36, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor(CYAN)
    .text("EGYPT", 48, 60, { width: 36, align: "center" });

  // Hospital name & dept
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(17)
    .text("National Research Centre (NRC)", 118, 16);
  doc
    .fillColor("#90caf9")
    .font("Helvetica")
    .fontSize(8.5)
    .text("Cardiology & Echocardiography Department", 118, 40)
    .text("EchoVision AI-Assisted Echocardiography Reporting System", 118, 52);

  // Contact strip
  doc
    .fillColor("#b0c4de")
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      "Dokki, Giza, Egypt  |  +20 2 33370931  |  www.nrc.sci.eg  |  echovision@nrc.sci.eg",
      118,
      72,
      { width: 410 },
    );

  // Heart + ECG icon (top-right)
  doc.circle(543, 54, 33).fill("#1a3a6e").stroke(CYAN);
  const hx = 543,
    hy = 50;
  doc
    .save()
    .translate(hx, hy)
    .scale(0.3)
    .moveTo(0, -22)
    .bezierCurveTo(-44, -54, -84, -8, -40, 22)
    .bezierCurveTo(-18, 42, 0, 58, 0, 58)
    .bezierCurveTo(0, 58, 18, 42, 40, 22)
    .bezierCurveTo(84, -8, 44, -54, 0, -22)
    .fillColor(BLUE_LIGHT)
    .fill()
    .restore();
  doc
    .save()
    .translate(hx - 28, hy + 2)
    .moveTo(0, 0)
    .lineTo(7, 0)
    .lineTo(11, -11)
    .lineTo(16, 13)
    .lineTo(21, -11)
    .lineTo(26, 13)
    .lineTo(31, 0)
    .lineTo(56, 0)
    .lineWidth(1.6)
    .strokeColor("white")
    .stroke()
    .restore();

  // Cyan accent stripe
  doc.rect(0, 108, W, 4).fill(CYAN);

  // ════════════════════════════════════════════════════
  // 2. TITLE BAR
  // ════════════════════════════════════════════════════
  doc.rect(0, 112, W, 38).fill(OFFWHITE);
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("ECHOVISION AI ECHOCARDIOGRAPHY REPORT", 0, 124, {
      align: "center",
      width: W,
    });

  // ════════════════════════════════════════════════════
  // 3. PATIENT & STUDY INFORMATION
  // ════════════════════════════════════════════════════
  const tableY = 163;
  const tableH = 109;

  doc
    .rect(44, tableY, W - 88, tableH)
    .fill("white")
    .stroke(BORDER);
  doc.rect(44, tableY, W - 88, 27).fill(NAVY);
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("PATIENT & STUDY INFORMATION", 58, tableY + 9);

  const patientName =
    `${report.patient_first_name ?? ""} ${report.patient_last_name ?? ""}`.trim() ||
    "N/A";

  infoRow(
    tableY + 27,
    "Patient Name:",
    patientName,
    "Study Type:",
    report.study_type || "N/A",
    false,
  );
  infoRow(
    tableY + 54,
    "Study Date:",
    studyDateStr,
    "Report Date:",
    reportDateStr,
    true,
  );
  infoRow(
    tableY + 81,
    "Doctor:",
    report.assigned_doctor || "N/A",
    "Signed At:",
    signedAtStr,
    false,
  );

  doc
    .rect(44, tableY, W - 88, tableH)
    .lineWidth(0.8)
    .stroke(BORDER);

  // ════════════════════════════════════════════════════
  // 4. FINDINGS & AI ANALYSIS
  // ════════════════════════════════════════════════════
  const findY = tableY + tableH + 14;

  doc.rect(44, findY, W - 88, 26).fill(NAVY);
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("FINDINGS & AI ANALYSIS", 58, findY + 9);

  const content = report.report_content || "";
  const sections = [
    { title: "Measurements", key: "Measurements:" },
    { title: "Detected Conditions", key: "Detected Conditions:" },
    { title: "Clinical Impression", key: "Clinical Impression:" },
    { title: "Notes", key: "Physician Interpretation:" },
  ];

  const hasStructuredSections = sections.some((s) => content.includes(s.key));
  let parsed;

  if (!hasStructuredSections && content.trim()) {
    parsed = [
      {
        title: "Clinical Findings",
        key: "",
        body: content.trim(),
      },
    ];
  } else {
    parsed = sections.map((s, i) => {
      const start = content.indexOf(s.key);
      if (start === -1) return { ...s, body: "" };
      const nextIdx =
        sections
          .slice(i + 1)
          .map((n) => content.indexOf(n.key))
          .filter((p) => p > start)[0] ?? content.length;
      return {
        ...s,
        body: content.slice(start + s.key.length, nextIdx).trim(),
      };
    });

    const physicianIdx = parsed.findIndex((s) => s.key === "Physician Interpretation:");
    if (physicianIdx >= 0 && !parsed[physicianIdx].body && content.trim()) {
      const orphanText = content
        .replace(/Measurements:[\s\S]*?(?=Detected Conditions:|Clinical Impression:|Physician Interpretation:|$)/gi, "")
        .replace(/Detected Conditions:[\s\S]*?(?=Clinical Impression:|Physician Interpretation:|$)/gi, "")
        .replace(/Clinical Impression:[\s\S]*?(?=Physician Interpretation:|$)/gi, "")
        .replace(/Physician Interpretation:/gi, "")
        .trim();
      if (orphanText) {
        parsed[physicianIdx].body = orphanText;
      }
    }
  }

  // Calculate dynamic height for findings body
  let findBodyH = 18;
  parsed.forEach((s) => {
    findBodyH +=
      14 + 7 + doc.heightOfString(s.body || "N/A", { width: W - 116 }) + 14;
  });
  findBodyH = Math.max(findBodyH, 180);

  doc
    .rect(44, findY + 26, W - 88, findBodyH)
    .fill("white")
    .stroke(BORDER);

  let curY = findY + 26 + 14;
  parsed.forEach((s) => {
    doc
      .fillColor(TEXT_BLUE)
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(s.title, 58, curY);
    curY += 14;
    hRule(58, curY, W - 116);
    curY += 7;
    doc
      .fillColor(DARK)
      .font("Helvetica")
      .fontSize(8.8)
      .text(s.body || "N/A", 58, curY, { width: W - 116 });
    curY += doc.heightOfString(s.body || "N/A", { width: W - 116 }) + 14;
  });

  // ── (Additional Notes section removed) ──

  // ════════════════════════════════════════════════════
  // 6. DIGITAL SIGNATURE & CERTIFICATION
  // ════════════════════════════════════════════════════
  const sigY = curY + 14;
  const sigH = 120;

  doc
    .rect(44, sigY, W - 88, sigH)
    .fill("white")
    .lineWidth(1)
    .stroke(BORDER);
  doc.rect(44, sigY, W - 88, 26).fill(NAVY);
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("DIGITAL SIGNATURE & CERTIFICATION", 58, sigY + 7);

  // ── Left: doctor details ──
  doc
    .fillColor(BLUE)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(report.signing_doctor || "N/A", 55, sigY + 36);
  doc
    .fillColor(MID)
    .font("Helvetica")
    .fontSize(9)
    .text("Consultant Cardiologist", 55, sigY + 54)
    .text(`Signed: ${signedAtStr}`, 55, sigY + 70);

  // ── Verified badge ──
  doc
    .roundedRect(230, sigY + 48, 105, 30, 15)
    .fillAndStroke("#dcfce7", "#22c55e");
  doc.circle(246, sigY + 63, 10).fill("#22c55e");
  doc
    .moveTo(242, sigY + 63)
    .lineTo(245, sigY + 67)
    .lineTo(251, sigY + 58)
    .lineWidth(2)
    .strokeColor("white")
    .stroke();
  doc
    .fillColor("#166534")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("VERIFIED", 260, sigY + 57);

  // ── NRC Approved stamp ──
  const stampX = W - 285;
  const stampY = sigY + 64;
  doc.circle(stampX, stampY, 24).lineWidth(2).strokeColor("#22c55e").stroke();
  doc.circle(stampX, stampY, 18).lineWidth(1).strokeColor("#22c55e").stroke();
  doc
    .fillColor("#16a34a")
    .fontSize(7)
    .font("Helvetica-Bold")
    .text("NRC\nAPPROVED", stampX - 14, stampY - 10, {
      width: 28,
      align: "center",
    });

  // ── Signature box ──
  doc
    .roundedRect(W - 255, sigY + 28, 200, 72, 8)
    .fill("#ffffff")
    .stroke("#d1d5db");

  const signatureName = (report.signing_doctor || "")
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .join("  ");

  // Handwritten effect: skew matrix → cursive lean
  doc.save();
  doc.transform(1, -0.08, 0.12, 1, W - 252, sigY + 38);
  doc
    .fillColor("#1d4ed8")
    .font("Times-Italic")
    .fontSize(26)
    .text(signatureName, 0, 0, { width: 188, align: "center" });
  doc.restore();

  // Wavy flourish underline + tail loop
  const flX = W - 235;
  const flY = sigY + 80;
  doc
    .moveTo(flX, flY)
    .bezierCurveTo(flX + 28, flY + 5, flX + 68, flY - 4, flX + 108, flY + 3)
    .bezierCurveTo(flX + 128, flY + 6, flX + 146, flY - 2, flX + 152, flY)
    .bezierCurveTo(flX + 159, flY - 7, flX + 165, flY + 5, flX + 155, flY + 9)
    .lineWidth(1.2)
    .strokeColor("#1d4ed8")
    .stroke();

  doc
    .moveTo(W - 235, sigY + 82)
    .lineTo(W - 80, sigY + 82)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();
  doc
    .fillColor("#64748b")
    .fontSize(8)
    .font("Helvetica")
    .text("Authorized Signature", W - 248, sigY + 86, {
      width: 186,
      align: "center",
    });

  // ════════════════════════════════════════════════════
  // 7. FOOTER
  // ════════════════════════════════════════════════════
  doc.rect(0, H - 49, W, 4).fill(CYAN);
  doc.rect(0, H - 45, W, 45).fill(NAVY);
  doc
    .fillColor("#a0c4ff")
    .fontSize(7.5)
    .font("Helvetica")
    .text(
      "This report was generated electronically and is valid without a physical signature. For inquiries: info@echovision.eg",
      0,
      H - 33,
      { align: "center", width: W },
    );
  doc
    .fillColor("white")
    .fontSize(7.5)
    .text(
      "EchoVision AI Platform  |  National Research Centre (NRC)  |  Confidential Medical Document",
      0,
      H - 20,
      { align: "center", width: W },
    );

  // ────────────────────────────────────────────────────
  doc.end();

  const publicPath = `/uploads/reports/${fileName}`;
  await db.query(`UPDATE Reports SET report_file_path = ? WHERE study_id = ?`, [
    publicPath,
    study_id,
  ]);

  return publicPath;
};
