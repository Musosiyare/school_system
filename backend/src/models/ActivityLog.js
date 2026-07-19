const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class ActivityLog extends Model {}

// One row per action a user takes on something that matters — created a
// student, renamed a class, recorded marks, deactivated a teacher, etc.
// This is a personal history, not a cross-user audit trail: each user only
// ever queries their own rows (see activityLogController.listMyActivity),
// so there's no read access to anyone else's log built on top of this.
ActivityLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // Whoever performed the action. Superuser actions aren't scoped to a
    // school, so schoolId is nullable — it records which school the action
    // affected, when there is one, not which school the actor belongs to.
    userId: { type: DataTypes.INTEGER, allowNull: false },
    schoolId: { type: DataTypes.INTEGER, allowNull: true },
    // Short machine-readable code, e.g. "student.created", "class.deleted",
    // "marks.recorded", "teacher.status_changed" — namespaced by entity so
    // it's easy to filter/extend later without a schema change.
    action: { type: DataTypes.STRING, allowNull: false },
    // The human-readable line shown in the UI — written once at the call
    // site where all the relevant names are already in scope, rather than
    // reconstructed later from entityType/entityId.
    description: { type: DataTypes.TEXT, allowNull: false },
    entityType: { type: DataTypes.STRING, allowNull: true },
    entityId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "ActivityLog",
    tableName: "activity_logs",
    indexes: [
      // Every real query filters by userId and sorts by createdAt DESC —
      // this index lets MySQL satisfy both from the index itself instead
      // of scanning + sorting the whole table as it grows.
      { fields: ["userId", "createdAt"] },
    ],
  }
);

module.exports = ActivityLog;
