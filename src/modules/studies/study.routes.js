const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("../../config/db");

const controller = require("./study.controller");
const auth = require("../../middleware/auth.middleware");
const role = require("../../middleware/role.middleware");
const upload = require("../../middleware/upload.middleware");
const notify = require("../../middleware/notify.middleware");

// ================= MIME TYPE HELPER =================
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".dcm": "application/dicom",
    ".dicom": "application/dicom",
    ".nii": "application/octet-stream",
    ".mha": "application/octet-stream",
    ".mhd": "application/octet-stream",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".wmv": "video/x-ms-wmv",
    ".mkv": "video/x-matroska",
  };
  return map[ext] ?? "application/octet-stream";
}

// ================= UPLOAD IMAGES =================
// Doctor only
router.post("/:study_id/images", auth, role("Doctor"), upload.array("images", 5), notify.onImageUpload, controller.uploadImages);

// =================  SERVE IMAGE (PROTECTED) [created by farah] =================
router.get(
  "/:study_id/images/:image_id",
  auth,
  role("Doctor", "Admin"),
  notify.onImageAccess , 
  async (req, res) => {
    try {
      const { study_id, image_id } = req.params;

      const [image] = await db.query(
        `SELECT file_path FROM images
         WHERE image_id = ? AND study_id = ?`,
        [image_id, study_id],
      );

      if (!image.length) {
        return res.status(404).json({ message: "Image not found" });
      }

      const absolutePath = path.resolve(image[0].file_path);
      const mimeType = getMimeType(image[0].file_path);

      res.setHeader("Content-Type", mimeType);
      res.sendFile(absolutePath);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// ================= COMPLETE STUDY =================
// Doctor only
router.put(
  "/complete/:study_id",
  auth,
  role("Doctor"),
  controller.completeStudy,
);

// ================= SAVE NOTES [created by farah] =================
router.patch("/:study_id/notes", auth, role("Doctor"), controller.saveNotes);

// ================= DELETE NOTE [created by farah] =================
router.delete(
  "/:study_id/notes/:note_id",
  auth,
  role("Doctor"),
  controller.deleteNote,
);
module.exports = router;

// ================= DELETE IMAGE [created by farah] =================
router.delete(
  "/:study_id/images/:image_id",
  auth,
  role("Doctor"),
  controller.deleteImage,
);