const studyService = require("./study.service");

// ================= UPLOAD IMAGES =================
exports.uploadImages = async (req, res) => {
  try {
    const doctor_id = req.user.id;
    const { study_id } = req.params;
    const { view_type } = req.body;

    // ================= VALIDATION =================
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    if (!view_type) {
      return res.status(400).json({
        success: false,
        message: "view_type is required",
      });
    }

    // ================= SERVICE CALL =================
    const result = await studyService.uploadImages(
      study_id,
      req.files,
      doctor_id,
      view_type,
    );

    // ================= RESPONSE =================
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

// exports.uploadImages = async (req, res) => {
//   try {
//     // Logged-in doctor id from JWT token
//     const doctor_id = req.user.id;

//     // study id from route params
//     const { study_id } = req.params;

//     // view type from form-data body
//     const { view_type } = req.body;

//     const result = await studyService.uploadImages(
//       study_id,
//       req.files,
//       doctor_id,
//       view_type
//     );

//     res.status(200).json(result);

//   } catch (err) {
//     res.status(err.status || 500).json({
//       message: err.message
//     });
//   }
// };
// exports.uploadImages = async (req, res) => {
//   try {
//     const doctor_id = req.user.id;

//     const result = await studyService.uploadImages(
//       req.params.study_id,
//       req.files,
//       doctor_id
//     );

//     res.status(200).json(result);
//   } catch (err) {
//     res.status(err.status || 500).json({ message: err.message });
//   }
// };

// ================= COMPLETE STUDY =================
exports.completeStudy = async (req, res, next) => {
  try { 
    const { study_id } = req.params;
    const doctor_id = req.user.id;

    const result = await studyService.completeStudy(study_id, doctor_id);

    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ================= SAVE NOTES [created by farah] =================
exports.saveNotes = async (req, res) => {
  try {
    const { study_id } = req.params;
    const { notes, note_id } = req.body;
    const db = require("../../config/db");
    const [doctorRows] = await db.query(
      `SELECT first_name, last_name FROM Users WHERE user_id = ?`,
      [req.user.id],
    );
    const doctor_name = doctorRows.length
      ? `${doctorRows[0].first_name} ${doctorRows[0].last_name}`.trim()
      : "Doctor";

    const result = await studyService.saveStudyNotes(
      study_id,
      notes,
      doctor_name,
      note_id ?? null,
    );

    res.status(200).json({
      success: true,
      message: result.message,
      notes: result.notes, // always return full updated array
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

// ================= DELETE NOTE [created by farah] =================
exports.deleteNote = async (req, res) => {
  try {
    const { study_id, note_id } = req.params;

    const result = await studyService.deleteStudyNote(study_id, note_id);

    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

// ================= DELETE IMAGE [created by farah] =================
exports.deleteImage = async (req, res) => {
  try {
    const { study_id, image_id } = req.params;
    const doctor_id = req.user.id;

    const result = await studyService.deleteImage(study_id, image_id, doctor_id);

    res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};