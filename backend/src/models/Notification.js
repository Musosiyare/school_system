const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Notification extends Model {}

// A reminder sent teacher-to-teacher — e.g. a class teacher nudging a subject
// teacher who hasn't finished recording marks for a term. classId/moduleId/
// termId are optional context so the recipient can jump straight to what's
// being asked of them; they're null for a plain freeform message.
Notification.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: true },
    moduleId: { type: DataTypes.INTEGER, allowNull: true },
    termId: { type: DataTypes.INTEGER, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Tags system-generated notifications (as opposed to a teacher/manager's
    // own freeform reminder) so they can be found and cleared as a batch —
    // e.g. "maintenance_schedule" notices get deleted the moment the
    // notification is turned off, cancelled, or superseded. Null for
    // ordinary person-to-person notifications.
    source: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, modelName: "Notification", tableName: "notifications" }
);

module.exports = Notification;
