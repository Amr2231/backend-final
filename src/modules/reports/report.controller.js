const service = require("./report.service");
const path = require("path");

// OPEN REPORT
exports.openReport = async (req, res) => {
  try {
    const result = await service.openReport(
      req.params.study_id
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// AUTO SAVE
exports.autoSave = async (req, res) => {
  try {
    const result = await service.autoSaveReport(
      req.params.study_id,
      req.body.content
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// INSERT AI FINDINGS
exports.insertAIFindings = async (req, res) => {
  try {
    const result = await service.insertAIFindings(
      req.params.study_id,
      req.user.id,
      req.body.doctorInterpretation || ""
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// FINALIZE
exports.finalize = async (req, res) => {
  try {
    if (req.user.role !== "Doctor") {
      return res.status(403).json({ message: "Only doctors can finalize reports" });
    }

    const result = await service.finalizeReport(
      req.params.study_id,
      req.user.id
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// GET REPORT
exports.getReport = async (req, res) => {
  try {
    const result = await service.getReport(req.params.study_id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// EXPORT PDF (DOWNLOAD)
exports.exportPDF = async (req, res) => {
  try {
    const filePath = await service.exportReport(req.params.study_id);

    res.download(
      path.resolve(
        __dirname,
        "../../uploads/reports",
        path.basename(filePath)
      )
    );

  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};