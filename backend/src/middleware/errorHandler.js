const ApiError = require("../utils/ApiError");

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, field: err.field },
    });
  }

  // Sequelize unique constraint violation
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      error: { code: "DUPLICATE_ENTRY", message: "A record with these values already exists" },
    });
  }

  // multer (file upload) errors — e.g. file too large or wrong field name
  if (err.name === "MulterError") {
    return res.status(400).json({
      error: { code: "UPLOAD_ERROR", message: err.message },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." },
  });
};
