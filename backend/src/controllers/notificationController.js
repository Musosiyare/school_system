const { Notification, User, Class, Module, Term } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/notifications — send a reminder to another teacher in the same
// school. Typically used by a class teacher nudging a subject teacher who
// hasn't finished recording marks, but classId/moduleId/termId are optional
// so it also works as a plain message.
const sendNotification = asyncHandler(async (req, res) => {
  const { recipientId, classId, moduleId, termId, message } = req.body;

  if (!recipientId || !message?.trim()) {
    throw ApiError.badRequest("recipientId and message are required");
  }

  const recipient = await User.findOne({
    where: { id: recipientId, schoolId: req.schoolId, role: "teacher" },
  });
  if (!recipient) throw ApiError.badRequest("Invalid recipientId for this school");

  // A reminder about marks recording is pointless once the term is locked —
  // nobody can record anything anymore, so block it here too (not just in
  // the UI) in case the request comes from a stale screen.
  if (termId) {
    const term = await Term.findByPk(termId);
    if (!term) throw ApiError.badRequest("Invalid termId");
    if (term.isLocked) {
      throw ApiError.termLocked("This term is locked — marks recording reminders can't be sent for it.");
    }
  }

  // If sent in the context of a class, the sender must actually be that
  // class's class teacher (managers can send on behalf of the school).
  if (classId) {
    const klass = await Class.findOne({ where: { id: classId, schoolId: req.schoolId } });
    if (!klass) throw ApiError.badRequest("Invalid classId for this school");
    if (req.user.role === "teacher" && klass.classTeacherId !== req.user.id) {
      throw ApiError.forbidden("You are not the class teacher for this class");
    }
  }

  const notification = await Notification.create({
    schoolId: req.schoolId,
    senderId: req.user.id,
    recipientId,
    classId: classId || null,
    moduleId: moduleId || null,
    termId: termId || null,
    message: message.trim(),
  });

  res.status(201).json({ notification });
});

// GET /api/notifications/sent — reminders the current user has sent, newest
// first. Optionally filtered by termId. Powers the "already notified" check
// mark on the class teacher's marks-status view so a reminder isn't sent
// blind twice without the sender knowing.
const listSentNotifications = asyncHandler(async (req, res) => {
  const { termId } = req.query;
  const where = { senderId: req.user.id };
  if (termId) where.termId = termId;

  const notifications = await Notification.findAll({
    where,
    attributes: ["id", "recipientId", "classId", "moduleId", "termId", "createdAt"],
    order: [["createdAt", "DESC"]],
  });
  res.json({ notifications });
});

// GET /api/notifications — the current user's inbox: unread reminders,
// newest first. Marking one read clears it from here for good (read =
// dismissed, not just grayed out) — there's no separate "history" view.
const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { recipientId: req.user.id, isRead: false },
    include: [
      { model: User, as: "sender", attributes: ["id", "name"] },
      { model: Class, attributes: ["id", "name"] },
      { model: Module, attributes: ["id", "moduleTitle", "moduleCode"] },
      { model: Term, attributes: ["id", "name"] },
    ],
    order: [["createdAt", "DESC"]],
    limit: 50,
  });
  res.json({ notifications });
});

// PATCH /api/notifications/:id/read
const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: { id: req.params.id, recipientId: req.user.id },
  });
  if (!notification) throw ApiError.notFound("Notification not found");
  if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }
  res.json({ notification });
});

// PATCH /api/notifications/read-all
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.update(
    { isRead: true },
    { where: { recipientId: req.user.id, isRead: false } }
  );
  res.json({ success: true });
});

module.exports = {
  sendNotification,
  listMyNotifications,
  listSentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
