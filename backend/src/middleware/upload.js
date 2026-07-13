const multer = require("multer");

// Memory storage — files are small (a single class roster) and we only
// ever need the buffer briefly to parse it with exceljs, no reason to
// touch disk.
const storage = multer.memoryStorage();

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream", // some browsers/OSes send this for .xlsx
]);

function fileFilter(req, file, cb) {
  const isXlsxExt = file.originalname.toLowerCase().endsWith(".xlsx");
  if (isXlsxExt && XLSX_MIME_TYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only .xlsx files are accepted"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB is generous for a marks roster
});

module.exports = upload;
