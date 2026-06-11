const service = require("./patient.service");

exports.register = async (req, res) => {
  try {
    const result = await service.registerPatientWithStudy(req.body);

    res.status(201).json({
      success: true,
      message: result.message,

      // 🔥 FIX: return full data instead of only study_id
      patient: result.patient,
      study: result.study,
      meta: result.meta || null,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// ================= UC-07 Update =================
exports.update = async (req, res, next) => {
  try {
    const result = await service.updatePatient(
      req.params.national_id,
      req.body,
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

// ================= UC-08 Delete =================
exports.delete = async (req, res, next) => {
  try {
    const result = await service.deletePatient(req.params.national_id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

// ================= COMPLETE (marks latest study as Completed) [created by farah] =================
exports.complete = async (req, res, next) => {
  try {
    const { national_id } = req.params;
    const db = require("../../config/db");

    const [study] = await db.query(
      `SELECT study_id FROM studies
       WHERE national_id = ? AND status != 'Completed'
       ORDER BY study_date DESC LIMIT 1`,
      [national_id],
    );

    if (!study.length) {
      return res.status(404).json({
        success: false,
        message: "No active study found for this patient",
      });
    }

    await db.query(
      `UPDATE studies SET status = 'Completed' WHERE study_id = ?`,
      [study[0].study_id],
    );

    res.json({
      success: true,
      message: "Patient study marked as completed",
      study_id: study[0].study_id,
    });
  } catch (err) {
    next(err);
  }
};


// ================= Query Patients =================
exports.queryPatients = async (req, res) => {
  try {
    const { keyword, study_type, date, page, limit } = req.query;

    const data = await service.queryPatients({
      keyword,
      study_type,
      date,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// ================= UC-34 Active Patients [farah edit] =================
exports.getActive = async (req, res, next) => {
  try {
    const { page, limit, keyword, study_type, date, doctor_id, sort } =
      req.query; // farah edit by add sort query param

    const data = await service.getActivePatients(page, limit, {
      keyword,
      study_type,
      date,
      sort, // farah edit by add sort
      doctor_id,
    });

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};

// ================= UC-36 Historical Patients =================
exports.getHistory = async (req, res, next) => {
  try {
    const { page, limit, keyword, study_type, date, sort, report_status } =
      req.query; // farah edit by add keyword, study_type, date , sort query param and report_status

    const data = await service.getHistoricalPatients(page, limit, {
      keyword,
      study_type,
      date,
      sort, // farah edit by add keyword, study_type, date , sort query param
      report_status, // farah edit by add report_status
    });

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};

// ================= UC Reassign doctor =================
exports.reassignDoctor = async (req, res, next) => {
  try {
    const { national_id } = req.params;

    const { doctor_id, study_type, study_date } = req.body;

    const result = await service.reassignDoctor(
      national_id,
      doctor_id,
      study_type,
      study_date,
    );

    res.status(200).json({
      success: true,
      message: result.message,
      doctor: result.doctor,
      study: result.study, // ✅ return full object
    });
  } catch (err) {
    next(err);
  }
};

// ================= UC-17 View Assigned Patients =================
// exports.getAssigned = async (req, res, next) => {
//   try {

//     const { page, limit } = req.query;

//     const data = await service.getAssignedPatients(
//       req.user.id,
//       page,
//       limit
//     );

//     res.json({
//       success: true,
//       ...data
//     });

//   } catch (err) {
//     next(err);
//   }
// };

exports.getAssigned = async (req, res, next) => {
  try {
    const { page, limit, keyword, study_type, date, sort, report_status } =
      req.query; // farah edit by add report_status

    const data = await service.getAssignedPatients(req.user.id, page, limit, {
      keyword,
      study_type,
      date,
      sort,
      report_status, // farah edit by add report_status
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ================= GET DEACTIVATED PATIENTS (Admin) [created by farah] =================
exports.getDeactivated = async (req, res, next) => {
  try {
    const { page, limit, keyword, sort } = req.query;
    const data = await service.getDeactivatedPatients(page, limit, {
      keyword,
      sort,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

// ================= REACTIVATE PATIENT (Admin) =================
exports.reactivate = async (req, res, next) => {
  try {
    const result = await service.reactivatePatient(req.params.national_id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
};

// ================= GET DOCTOR HISTORICAL PATIENTS (doctor) [created by farah] =================
exports.getDoctorHistory = async (req, res, next) => {
  try {
    const { page, limit, keyword, study_type, date, sort, report_status } =
      req.query;

    const data = await service.getDoctorHistoricalPatients(
      req.user.id,
      page,
      limit,
      {
        keyword,
        study_type,
        date,
        sort,
        report_status,
      },
    );

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ================ GET RECENT PATIENTS (doctor) [created by farah] =================
exports.getRecentPatients = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const data = await service.getRecentPatients(req.user.id, page, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ================= GET PATIENT BY STUDY ID (doctor) =================
exports.getByStudyId = async (req, res, next) => {
  try {
    const patient = await service.getPatientByStudyId(
      req.user.id,
      req.params.study_id,
    );
    res.json({ success: true, patient });
  } catch (err) {
    next(err);
  }
};
