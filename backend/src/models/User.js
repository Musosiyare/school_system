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
      type: DataTypes.ENUM("superuser", "manager", "teacher"),
      allowNull: false,
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
