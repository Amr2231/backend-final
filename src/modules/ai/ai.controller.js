const service = require("./ai.service");
const db = require("../../config/db"); // added by farah
const { getDiagnosis } = require("./ai.service");
// ================= RUN AI =================
exports.runAI = async (req, res) => {
  try {
    const study_id = req.params.study_id;
    const image_id = req.body?.image_id ?? null; // added by farah

    // const result = await service.runAIAnalysis(study_id);
    const result = await service.runAIAnalysis(study_id, image_id); // added by farah

    res.status(200).json({
      success: true,
      message: result.message,
      study_id: study_id, // 🔥 FIXED (always from params)
      data: result.data || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI service unavailable or crashed",
      study_id: req.params.study_id || null,
      data: null,
      error: error.message,
    });
  }
};

// ================= VALIDATE AI =================
exports.validateAI = async (req, res) => {
  try {
    const study_id = req.params.study_id;

    const doctor_id = req.user?.user_id || req.user?.id || req.user?.userId;

    const { action } = req.body;

    const result = await service.validateAI(study_id, doctor_id, action);

    res.status(200).json({
      success: true,
      message: result.message,
      study_id, // 🔥 FIXED
      doctor_id,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Validation failed",
      study_id: req.params.study_id || null,
      doctor_id: req.user?.user_id || req.user?.id || req.user?.userId || null,
    });
  }
};

// // ================= EDIT AI =================
exports.editAI = async (req, res) => {
  try {
    const study_id = req.params.study_id;

    const doctor_id = req.user?.user_id || req.user?.id || req.user?.userId;

    const edits = req.body;

    const result = await service.editAIResult(study_id, doctor_id, edits);

    res.status(200).json({
      success: true,
      message: result.message,
      study_id: study_id,
      doctor_id: doctor_id,
      data: result.data,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Edit failed",
      study_id: req.params.study_id || null,
      doctor_id: req.user?.user_id || req.user?.id || req.user?.userId || null,
      data: null,
    });
  }
};

exports.getAIResult = async (req, res) => {
  try {
    const { study_id } = req.params;

    const [aiRows] = await db.query(
      `SELECT * FROM aI_Results WHERE study_id = ?`,
      [study_id],
    );

    const [valRows] = await db.query(
      `SELECT status FROM AI_Validation WHERE study_id = ?`,
      [study_id],
    );

    if (!aiRows.length) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No AI result found",
      });
    }

    // added by farah
    const classification = getDiagnosis(aiRows[0]);
    // added by farah
    // const result = aiRows[0];
    // const hasHF = Number(result.has_hfref) === 1;
    // const hasLVH = Number(result.has_lvh) === 1;

    // let diagnosis, summary;

    // if (!hasHF && !hasLVH) {
    //   diagnosis = "Normal";
    //   summary = "No Heart Failure or LVH detected";
    // } else if (hasHF && !hasLVH) {
    //   diagnosis = "Heart Failure";
    //   summary = "Heart Failure detected";
    // } else if (!hasHF && hasLVH) {
    //   diagnosis = "LVH";
    //   summary = "Left Ventricular Hypertrophy detected";
    // } else {
    //   diagnosis = "Heart Failure + LVH";
    //   summary = "Both Heart Failure and LVH detected";
    // }

    return res.status(200).json({
      success: true,
      data: {
        ...aiRows[0],
        diagnosis: classification.diagnosis, 
        summary: classification.summary, 
        validation_status: valRows[0]?.status ?? "Pending",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
