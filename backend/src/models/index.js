const sequelize = require("../config/database");
const School = require("./School");
const User = require("./User");
const AcademicYear = require("./AcademicYear");
const Class = require("./Class");
const Module = require("./Module");
const ClassModule = require("./ClassModule");
const TeacherModuleAssignment = require("./TeacherModuleAssignment");
const Student = require("./Student");
const StudentEnrollment = require("./StudentEnrollment");
const Term = require("./Term");
const Mark = require("./Mark");
const ReportRemark = require("./ReportRemark");
const Notification = require("./Notification");
const SystemSetting = require("./SystemSetting");

// School -> Users, AcademicYears, Classes, Modules, Students
School.hasMany(User, { foreignKey: "schoolId" });
User.belongsTo(School, { foreignKey: "schoolId" });

School.hasMany(AcademicYear, { foreignKey: "schoolId" });
AcademicYear.belongsTo(School, { foreignKey: "schoolId" });

School.hasMany(Class, { foreignKey: "schoolId" });
Class.belongsTo(School, { foreignKey: "schoolId" });

School.hasMany(Module, { foreignKey: "schoolId" });
Module.belongsTo(School, { foreignKey: "schoolId" });

School.hasMany(Student, { foreignKey: "schoolId" });
Student.belongsTo(School, { foreignKey: "schoolId" });

// AcademicYear -> Classes, Terms
AcademicYear.hasMany(Class, { foreignKey: "academicYearId" });
Class.belongsTo(AcademicYear, { foreignKey: "academicYearId" });

AcademicYear.hasMany(Term, { foreignKey: "academicYearId" });
Term.belongsTo(AcademicYear, { foreignKey: "academicYearId" });

// Class -> Students, ClassTeacher, ClassModules
Class.hasMany(Student, { foreignKey: "classId" });
Student.belongsTo(Class, { foreignKey: "classId" });

Class.belongsTo(User, { as: "classTeacher", foreignKey: "classTeacherId" });
User.hasMany(Class, { as: "classesTaught", foreignKey: "classTeacherId" });

Class.hasMany(ClassModule, { foreignKey: "classId" });
ClassModule.belongsTo(Class, { foreignKey: "classId" });

Module.hasMany(ClassModule, { foreignKey: "moduleId" });
ClassModule.belongsTo(Module, { foreignKey: "moduleId" });

// Teacher assignments
User.hasMany(TeacherModuleAssignment, { foreignKey: "teacherId" });
TeacherModuleAssignment.belongsTo(User, { as: "teacher", foreignKey: "teacherId" });

Module.hasMany(TeacherModuleAssignment, { foreignKey: "moduleId" });
TeacherModuleAssignment.belongsTo(Module, { foreignKey: "moduleId" });

Class.hasMany(TeacherModuleAssignment, { foreignKey: "classId" });
TeacherModuleAssignment.belongsTo(Class, { foreignKey: "classId" });

// Marks
Student.hasMany(Mark, { foreignKey: "studentId" });
Mark.belongsTo(Student, { foreignKey: "studentId" });

Module.hasMany(Mark, { foreignKey: "moduleId" });
Mark.belongsTo(Module, { foreignKey: "moduleId" });

Term.hasMany(Mark, { foreignKey: "termId" });
Mark.belongsTo(Term, { foreignKey: "termId" });

Class.hasMany(Mark, { foreignKey: "classId" });
Mark.belongsTo(Class, { foreignKey: "classId" });

// Student enrollments — one row per student per academic year, recording
// which class they belonged to that year. Source of truth for historical
// rosters/reports; Student.classId remains the live/current pointer.
Student.hasMany(StudentEnrollment, { foreignKey: "studentId" });
StudentEnrollment.belongsTo(Student, { foreignKey: "studentId" });

Class.hasMany(StudentEnrollment, { foreignKey: "classId" });
StudentEnrollment.belongsTo(Class, { foreignKey: "classId" });

AcademicYear.hasMany(StudentEnrollment, { foreignKey: "academicYearId" });
StudentEnrollment.belongsTo(AcademicYear, { foreignKey: "academicYearId" });

// Report remarks
Student.hasMany(ReportRemark, { foreignKey: "studentId" });
ReportRemark.belongsTo(Student, { foreignKey: "studentId" });

Term.hasMany(ReportRemark, { foreignKey: "termId" });
ReportRemark.belongsTo(Term, { foreignKey: "termId" });

// Notifications — teacher-to-teacher reminders, optionally scoped to a
// class/module/term (e.g. "please finish recording marks").
User.hasMany(Notification, { as: "sentNotifications", foreignKey: "senderId" });
Notification.belongsTo(User, { as: "sender", foreignKey: "senderId" });

User.hasMany(Notification, { as: "receivedNotifications", foreignKey: "recipientId" });
Notification.belongsTo(User, { as: "recipient", foreignKey: "recipientId" });

Class.hasMany(Notification, { foreignKey: "classId" });
Notification.belongsTo(Class, { foreignKey: "classId" });

Module.hasMany(Notification, { foreignKey: "moduleId" });
Notification.belongsTo(Module, { foreignKey: "moduleId" });

Term.hasMany(Notification, { foreignKey: "termId" });
Notification.belongsTo(Term, { foreignKey: "termId" });

module.exports = {
  sequelize,
  School,
  User,
  AcademicYear,
  Class,
  Module,
  ClassModule,
  TeacherModuleAssignment,
  Student,
  StudentEnrollment,
  Term,
  Mark,
  ReportRemark,
  Notification,
  SystemSetting,
};
