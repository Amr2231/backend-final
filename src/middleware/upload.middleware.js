const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ================= STORAGE =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const study_id = req.params.study_id ?? "unknown"; // edited by farah

    let folder = "uploads/others";

    const ext = path.extname(file.originalname).toLowerCase();

    // Images
    if ([".png", ".jpg", ".jpeg", ".bmp", ".tiff"].includes(ext)) {
      folder = "uploads/images";
    }

    // Medical files
    else if (
      [".dcm", ".dicom", ".nii", ".nii.gz", ".mha", ".mhd"].includes(ext)
    ) {
      folder = "uploads/medical";
    }

    // Videos
    else if ([".mp4", ".avi", ".mov", ".wmv", ".mkv"].includes(ext)) {
      folder = "uploads/videos";
    }

    // Reports / Docs
    else if ([".pdf", ".doc", ".docx"].includes(ext)) {
      folder = "uploads/reports";
    }

    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

// ================= FILTER =================
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".tiff",

    // Medical
    ".dcm",
    ".dicom",
    ".nii",
    ".nii.gz",
    ".mha",
    ".mhd",

    // Video
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".mkv",

    // Reports
    ".pdf",
    ".doc",
    ".docx",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// ================= EXPORT =================
module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB
  },
});
