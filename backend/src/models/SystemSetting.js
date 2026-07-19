const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

// Singleton settings row (always id = 1). Currently just powers platform-wide
// maintenance mode, but the shape leaves room for more global toggles later
// without needing a new table each time.
class SystemSetting extends Model {}

SystemSetting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
    maintenanceMode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    maintenanceTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "We'll be right back",
    },
    maintenanceMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue:
        "The system is currently undergoing scheduled maintenance. Please check back shortly.",
    },
    updatedByName: { type: DataTypes.STRING, allowNull: true },
    // Lets a superuser announce a maintenance window ahead of time — staff see
    // scheduleAnnouncement as a heads-up banner. This is a notification only;
    // it never flips maintenanceMode on by itself. Cleared automatically once
    // scheduledAt passes (see settingsController.expireSchedule).
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    scheduleAnnouncement: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: "SystemSetting", tableName: "system_settings" }
);

module.exports = SystemSetting;
