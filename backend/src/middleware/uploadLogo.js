const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Logos are saved to disk (not memory) since, unlike the xlsx marks import,
// this file needs to persist and be served back out as a URL afterwards —
// see server.js for the express.static mount that serves this directory
// at /uploads.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "logos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// SVG is deliberately excluded — an uploaded SVG can embed <script>, which
// would execute in whoever's browser renders the logo (the report card
// page, and anyone previewing it in the admin profile).

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    // schoolId + timestamp keeps names unique per school and per upload,
    // and doubles as a cache-buster so a replaced logo doesn't keep
    // showing a browser-cached old image at the same URL.
    cb(null, `school-${req.schoolId}-${Date.now()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only PNG, JPG, or WEBP images are accepted"));
}

const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB is generous for a logo
});

module.exports = uploadLogo;
