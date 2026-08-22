const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Table: student_portal_credentials — physically the SAME table the
 * separate student-portal app defined (backend/src/models/StudentCredential.js
 * there). Both apps share one MySQL database; this model is now the
 * WRITABLE side for it, since credential management has moved into this
 * (main) system's Class Teacher / Students pages. The student-portal app's
 * own copy of this model stays as the student-facing login flow's own
 * read/write access to the same rows (checking passwordHash, bumping
 * tokenVersion on logout, etc.) — nothing there needed to change.
 *
 * `portalUsername` is generated once and never changes (see
 * utils/portalCredentials.js) — deliberately not the admission number,
 * since that gets reissued every year. `passwordHash` is bcrypt, same
 * convention as `users.passwordHash`. `tempPasswordEncrypted` is a
 * reversible AES-256-GCM copy (see utils/tempCredentials.js, same helper
 * this system already uses for staff temp passwords) so staff can look up
 * a still-unused temp password again, e.g. to reprint a login slip —
 * cleared the moment the student changes their own password.
 */
class StudentPortalCredential extends Model {}

StudentPortalCredential.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },

    portalUsername: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    mustChangePassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    tempPasswordEncrypted: { type: DataTypes.STRING, allowNull: true },
    tempPasswordSetAt: { type: DataTypes.DATE, allowNull: true },
    tempPasswordSetBy: { type: DataTypes.INTEGER, allowNull: true },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },

    status: { type: DataTypes.ENUM("active", "suspended"), allowNull: false, defaultValue: "active" },
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "StudentPortalCredential", tableName: "student_portal_credentials" }
);

module.exports = StudentPortalCredential;
