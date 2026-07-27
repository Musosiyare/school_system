const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: true }, // null for superuser
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    mustChangePassword: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Recoverable copy of the current temporary password (encrypted, not hashed —
    // see utils/tempCredentials.js). Cleared the moment the user changes their
    // own password; only ever set by an admin-facing "create/reset" action.
    tempPasswordEncrypted: { type: DataTypes.STRING, allowNull: true },
    tempPasswordSetAt: { type: DataTypes.DATE, allowNull: true },
    tempPasswordSetBy: { type: DataTypes.INTEGER, allowNull: true },
    // When the user last changed their own password (self-service), for audit.
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
    role: {
      type: DataTypes.ENUM("superuser", "manager", "teacher", "discipline"),
      allowNull: false,
    },
    // For the SBMS (Student Behavior Management System) companion app —
    // a manager assigns this here, in the main system, rather than SBMS
    // having its own way to grant access.
    //
    // role: "discipline" is for someone who ONLY does discipline work and
    // never teaches. Being a real, distinct role value (not just a flag on
    // top of "teacher") is what actually keeps them out of every
    // authorize("teacher") route in this system — marks entry, module
    // status, everywhere — not just the Teachers list. login() below also
    // blocks this role from this system entirely; they only ever use SBMS.
    //
    // A teacher who ALSO does discipline work keeps role: "teacher" (so
    // their teaching permissions are untouched) and gets disciplineRole
    // set alongside it — see the "New discipline staff from teachers" flow
    // on the Disciplinary Staff page. disciplineRole itself only matters
    // to SBMS; it never affects what someone can do in this system.
    disciplineRole: {
      type: DataTypes.ENUM("dean_of_discipline", "disciplinary_officer"),
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active",
    },
    // Bumped on every logout (and can be bumped for a forced sign-out later).
    // The JWT carries the tokenVersion it was issued with; authenticate()
    // rejects any token whose version doesn't match the current one, which is
    // what actually ends the session server-side instead of just relying on
    // the client to forget its token.
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // "Forgot password" (self-service, no admin involved) — currently only
    // offered to superuser accounts, since managers/teachers already have an
    // admin above them who can reset their password directly. We only ever
    // store a hash of the token (like a password), never the raw value, so a
    // database leak doesn't hand out working reset links.
    resetTokenHash: { type: DataTypes.STRING, allowNull: true },
    resetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: "User", tableName: "users" }
);

module.exports = User;
