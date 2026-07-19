class ApiError extends Error {
  constructor(statusCode, code, message, field = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
  }

  static badRequest(message, field) {
    return new ApiError(400, "VALIDATION_ERROR", message, field);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static conflict(message = "Conflict", code = "DUPLICATE_ENTRY") {
    return new ApiError(409, code, message);
  }
  static termLocked(message = "This term is locked") {
    return new ApiError(423, "TERM_LOCKED", message);
  }
  static reportsDisabled(
    message = "Reports for this term are temporarily disabled. Please ask the head teacher to view it."
  ) {
    return new ApiError(423, "REPORTS_DISABLED", message);
  }
  static yearArchived(
    message = "This academic year is archived and read-only. Switch to the current academic year to make changes."
  ) {
    return new ApiError(423, "YEAR_ARCHIVED", message);
  }
  static maintenance(message = "The system is currently under maintenance. Please check back shortly.") {
    return new ApiError(503, "MAINTENANCE_MODE", message);
  }
}

module.exports = ApiError;
