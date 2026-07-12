import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Field, Select, Textarea } from "../../components/ui/FormField";
import { useNotify } from "../../components/ui/NotifyProvider";
import {
  BellRing,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  ChevronDown,
  UserCheck,
} from "lucide-react";

// Builds one short, clean reminder that covers every outstanding module for
// a teacher at once (a teacher can easily have 5-8 modules in a class, and
// nobody wants 8 separate pings for the same class/term).
function buildReminderMessage(teacherName, className, termName, modules) {
  const firstName = teacherName?.split(" ")[0] || "there";
  const lines = modules
    .map((m) => `• ${m.moduleTitle} (${m.missingCount}/${m.totalStudents} missing)`)
    .join("\n");

  return `Hi ${firstName}, please complete marks recording for ${className} — ${termName}:

${lines}

Thanks!`;
}

// Marks-completion: lets a class teacher see which subject teachers still
// haven't finished recording marks for a term, and send them a reminder.
// Moved out of the dashboard and into its own nav page so the dashboard
// stays focused on a quick overview.
export default function MarksStatus() {
  const { user } = useAuth();
  const notify = useNotify();

  const [classesTaught, setClassesTaught] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  // Class teachers of several classes only see the first class open by
  // default — the rest are collapsed behind a chevron trigger so the page
  // isn't a wall of cards.
  const [expandedClassIds, setExpandedClassIds] = useState(new Set());
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [incompleteByClass, setIncompleteByClass] = useState({}); // classId -> { className, termName, totalStudents, modules, termLocked }
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);

  // "classId:teacherId" pairs a reminder has already gone out for, in the
  // selected term — drives the green "Notification sent" check mark.
  const [sentKeys, setSentKeys] = useState(new Set());

  // { classId, className, teacherId, teacherName, modules: [...] }
  const [notifyTarget, setNotifyTarget] = useState(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [sendingNotify, setSendingNotify] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/classes");
      const owned = data.classes.filter((c) => c.classTeacher?.id === user.id);
      setClassesTaught(owned);
      setLoadingClasses(false);
    })();
  }, [user.id]);

  // Auto-expand only the first class, once — after that the person is in
  // control of what's open/closed.
  useEffect(() => {
    if (hasAutoExpanded || classesTaught.length === 0) return;
    setExpandedClassIds(new Set([classesTaught[0].id]));
    setHasAutoExpanded(true);
  }, [classesTaught, hasAutoExpanded]);

  function toggleClass(classId) {
    setExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  // Terms for the current academic year — used to pick which term's marks
  // completion to check.
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/academic-years");
      const currentYearTerms = data.academicYears[0]?.Terms || [];
      setTerms(currentYearTerms);
      if (currentYearTerms.length > 0) {
        setSelectedTermId(String(currentYearTerms[0].id));
      }
    })();
  }, []);

  // Marks-completion status per class this teacher is the class teacher of,
  // for whichever term is selected.
  useEffect(() => {
    if (classesTaught.length === 0 || !selectedTermId) return;
    let cancelled = false;
    setIncompleteByClass({}); // avoid showing the previous term's (possibly different lock state) data while the new one loads
    (async () => {
      setLoadingIncomplete(true);
      try {
        const results = await Promise.all(
          classesTaught.map((c) =>
            api
              .get(`/classes/${c.id}/incomplete-marks`, { params: { termId: selectedTermId } })
              .then((res) => [c.id, res.data])
          )
        );
        if (!cancelled) setIncompleteByClass(Object.fromEntries(results));
      } finally {
        if (!cancelled) setLoadingIncomplete(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classesTaught, selectedTermId]);

  // Which teachers have already been sent a reminder for this term, so a
  // teacher who's been notified shows a green check mark instead of just
  // the button again.
  useEffect(() => {
    if (!selectedTermId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/notifications/sent", {
          params: { termId: selectedTermId },
        });
        if (cancelled) return;
        const keys = new Set(
          data.notifications
            .filter((n) => n.classId && n.recipientId)
            .map((n) => `${n.classId}:${n.recipientId}`)
        );
        setSentKeys(keys);
      } catch {
        // Non-critical — worst case the check mark just doesn't show yet.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTermId]);

  const selectedTerm = terms.find((t) => String(t.id) === selectedTermId);
  // The cached `terms` list can go stale if a manager locks/unlocks a term
  // while this page is already open. The per-term fetch below always hits
  // the database fresh, so prefer its termLocked flag once it's in — fall
  // back to the cached value only for the brief moment before it loads.
  const loadedIncompleteData = Object.values(incompleteByClass);
  const selectedTermLocked =
    loadedIncompleteData.length > 0 ? loadedIncompleteData[0]?.termLocked : !!selectedTerm?.isLocked;

  // Collapses a class's outstanding modules down to one row per subject
  // teacher (a teacher can carry several modules in the same class), plus a
  // separate bucket for the class teacher's own modules and any module with
  // nobody assigned yet.
  function groupByTeacher(outstandingModules) {
    const own = [];
    const unassigned = [];
    const byTeacher = new Map();

    for (const m of outstandingModules) {
      if (!m.teacherId) {
        unassigned.push(m);
      } else if (m.teacherId === user.id) {
        own.push(m);
      } else {
        if (!byTeacher.has(m.teacherId)) {
          byTeacher.set(m.teacherId, { teacherId: m.teacherId, teacherName: m.teacherName, modules: [] });
        }
        byTeacher.get(m.teacherId).modules.push(m);
      }
    }

    return {
      own,
      unassigned,
      teacherGroups: [...byTeacher.values()].sort((a, b) =>
        (a.teacherName || "").localeCompare(b.teacherName || "")
      ),
    };
  }

  function openNotify(classId, className, termName, group) {
    setNotifyTarget({
      classId,
      className,
      teacherId: group.teacherId,
      teacherName: group.teacherName,
      modules: group.modules,
    });
    setNotifyMessage(buildReminderMessage(group.teacherName, className, termName, group.modules));
  }

  async function sendReminder() {
    if (!notifyTarget || !notifyMessage.trim()) return;
    setSendingNotify(true);
    try {
      await api.post("/notifications", {
        recipientId: notifyTarget.teacherId,
        classId: notifyTarget.classId,
        termId: Number(selectedTermId),
        message: notifyMessage.trim(),
      });
      setSentKeys((prev) => new Set(prev).add(`${notifyTarget.classId}:${notifyTarget.teacherId}`));
      setNotifyTarget(null);
      setNotifyMessage("");
      await notify({ title: "Reminder sent", message: `${notifyTarget.teacherName} will see it next time they log in.`, tone: "info" });
    } catch (err) {
      await notify({ title: "Couldn't send reminder", message: err.message, tone: "error" });
    } finally {
      setSendingNotify(false);
    }
  }

  if (!loadingClasses && classesTaught.length === 0) {
    return (
      <Card title="Marks Recording Status">
        <p className="text-sm text-slate-400 py-4 text-center">
          You're not the class teacher for any class, so there's nothing to track here.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Marks Recording Status"
      subtitle="Who hasn't finished recording marks yet for the selected term."
      actions={
        terms.length > 0 && (
          <Select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-40"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )
      }
    >
      {terms.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">
          No academic year/terms set up yet.
        </p>
      ) : selectedTermLocked ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-700">
          <Lock size={15} className="shrink-0" />
          This term is locked by head teacher for marks recording. Contact for help.
        </div>
      ) : loadingIncomplete ? (
        <p className="text-sm text-slate-400 py-4 text-center">Checking marks…</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {classesTaught.map((c) => {
            const data = incompleteByClass[c.id];
            if (!data) return null;
            const outstanding = data.modules.filter((m) => !m.completed);
            const { own, unassigned, teacherGroups } = groupByTeacher(outstanding);
            const isOpen = expandedClassIds.has(c.id);
            // Single-class teachers don't need a collapse toggle at all —
            // there's nothing else to hide it behind.
            const collapsible = classesTaught.length > 1;

            return (
              <div key={c.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <div
                  role={collapsible ? "button" : undefined}
                  tabIndex={collapsible ? 0 : undefined}
                  onClick={collapsible ? () => toggleClass(c.id) : undefined}
                  onKeyDown={(e) => {
                    if (collapsible && (e.key === "Enter" || e.key === " ")) toggleClass(c.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-white text-left
                    ${collapsible ? "cursor-pointer hover:bg-slate-50 transition" : ""}`}
                >
                  <p className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">
                    {c.name}
                  </p>
                  {outstanding.length > 0 ? (
                    <Badge tone="teacher" className="shrink-0">
                      {outstanding.length} outstanding
                    </Badge>
                  ) : (
                    data.modules.length > 0 && (
                      <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 size={13} />
                        All recorded
                      </span>
                    )
                  )}
                  {collapsible && (
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  )}
                </div>

                {(isOpen || !collapsible) && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-3">
                    {data.modules.length === 0 ? (
                      <p className="text-xs text-slate-400">No modules assigned to this class yet.</p>
                    ) : outstanding.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        <CheckCircle2 size={15} />
                        All modules fully recorded for {data.termName}.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Your own modules: nothing to notify, you already know. */}
                        {own.length > 0 && (
                          <div className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-violet-50/60 px-3.5 py-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                              <UserCheck size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">
                                Your module{own.length > 1 ? "s" : ""}
                              </p>
                              <p className="text-xs text-slate-500">
                                {own.map((m) => m.moduleTitle).join(", ")} · still missing marks
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Modules with no subject teacher assigned yet: nobody to notify. */}
                        {unassigned.length > 0 && (
                          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/60 px-3.5 py-2.5">
                            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">No teacher assigned</p>
                              <p className="text-xs text-slate-500">
                                {unassigned.map((m) => m.moduleTitle).join(", ")}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* One row per subject teacher, covering every outstanding module of
                            theirs at once — a single reminder instead of one per module. */}
                        {teacherGroups.map((group) => {
                          const alreadySent = sentKeys.has(`${c.id}:${group.teacherId}`);
                          return (
                            <div
                              key={group.teacherId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5"
                            >
                              <div className="min-w-0 flex items-start gap-2.5">
                                <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">
                                    {group.teacherName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {group.modules.map((m) => m.moduleTitle).join(", ")}
                                    {" · "}
                                    {group.modules.length} module{group.modules.length === 1 ? "" : "s"} incomplete
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5">
                                {alreadySent && (
                                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">
                                    <CheckCircle2 size={13} />
                                    Sent
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant={alreadySent ? "teal" : "secondary"}
                                  onClick={() => openNotify(c.id, c.name, data.termName, group)}
                                >
                                  {alreadySent ? <RefreshCcw size={13} /> : <BellRing size={13} />}
                                  {alreadySent ? "Re-notify" : "Notify"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!notifyTarget}
        onClose={() => setNotifyTarget(null)}
        title="Send a Reminder"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNotifyTarget(null)}>
              Cancel
            </Button>
            <Button onClick={sendReminder} disabled={sendingNotify || !notifyMessage.trim()}>
              <Send size={14} />
              {sendingNotify ? "Sending..." : "Send Reminder"}
            </Button>
          </>
        }
      >
        {notifyTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              To <span className="font-medium text-slate-700">{notifyTarget.teacherName}</span> ·{" "}
              {notifyTarget.className} ·{" "}
              {notifyTarget.modules.length} module{notifyTarget.modules.length === 1 ? "" : "s"}
            </p>
            <Field label="Message">
              <Textarea
                rows={5}
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                autoFocus
              />
            </Field>
            <p className="text-xs text-slate-400">
              They'll see this the next time they log in.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
