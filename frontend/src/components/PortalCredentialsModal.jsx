import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { useConfirm } from "./ui/ConfirmProvider";
import { useNotify } from "./ui/NotifyProvider";
import { openCredentialsPrintWindow, downloadCredentialsCsv } from "../utils/printCredentials";
import { KeyRound, Eye, Ban, CheckCircle2, Users, Printer, FileDown } from "lucide-react";

/**
 * Manage a class's student portal login credentials — create/reset a
 * single student's account, bulk-issue for the whole class, peek an
 * unused temp password, suspend/reactivate access, and print/download the
 * whole class's credentials as a list. Used from both the Class Teacher
 * view (TeacherDashboard) and the manager's Students page. The backend
 * re-checks that a teacher is actually the class teacher of `classId` on
 * every call, so this component doesn't need to duplicate that check — it
 * just renders what the API allows.
 */
export default function PortalCredentialsModal({ open, onClose, classId, className }) {
  const confirm = useConfirm();
  const notify = useNotify();
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [revealBatch, setRevealBatch] = useState(null); // temp passwords to show/print

  const load = useCallback(() => {
    if (!classId) return;
    setLoading(true);
    setError("");
    api
      .get(`/classes/${classId}/portal-credentials`)
      .then(({ data }) => setStudents(data))
      .catch((err) => setError(err.message || "Failed to load students"))
      .finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleGenerateOne(studentId, { isReset = false } = {}) {
    if (isReset) {
      const ok = await confirm({
        title: "Reset this student's password?",
        message: "This issues a new temporary password and ends their current session. Their old password will stop working immediately.",
        confirmText: "Reset password",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(studentId);
    try {
      const { data } = await api.post(`/students/${studentId}/portal-credentials/generate`);
      setRevealBatch([data]);
      load();
    } catch (err) {
      await notify({ title: "Couldn't generate credentials", message: err.message, tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerateClass() {
    const total = students?.length ?? 0;
    const withExisting = students?.filter((s) => s.hasPortalAccount).length ?? 0;
    const ok = await confirm({
      title: "Generate for whole class?",
      message:
        withExisting > 0
          ? `This issues a new temporary password for all ${total} active student${total === 1 ? "" : "s"} in this class. ${withExisting} of them already ${withExisting === 1 ? "has" : "have"} an account — their current password will stop working immediately and any active session will end.`
          : `This issues a new temporary password for all ${total} active student${total === 1 ? "" : "s"} in this class.`,
      confirmText: "Generate for whole class",
      tone: "danger",
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const { data } = await api.post(`/classes/${classId}/portal-credentials/generate`);
      setRevealBatch(data.credentials);
      load();
    } catch (err) {
      await notify({ title: "Couldn't generate credentials", message: err.message, tone: "error" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handlePeek(studentId) {
    setBusyId(studentId);
    try {
      const { data } = await api.get(`/students/${studentId}/portal-credentials/peek`);
      setRevealBatch([data]);
    } catch (err) {
      await notify({ title: "Couldn't recover password", message: err.message, tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleStatus(studentId, currentStatus) {
    const next = currentStatus === "active" ? "suspended" : "active";
    if (next === "suspended") {
      const ok = await confirm({
        title: "Suspend portal access?",
        message: "This student won't be able to log in to the portal until you reactivate their access.",
        confirmText: "Suspend access",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusyId(studentId);
    try {
      await api.patch(`/students/${studentId}/portal-credentials/status`, { status: next });
      load();
    } catch (err) {
      await notify({ title: "Couldn't update status", message: err.message, tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function fetchPrintableRows() {
    const { data } = await api.get(`/classes/${classId}/portal-credentials/printable`);
    return data;
  }

  async function handlePrintAll() {
    setExportBusy(true);
    try {
      const data = await fetchPrintableRows();
      openCredentialsPrintWindow(`${data.className} — Portal Credentials`, data.rows);
    } catch (err) {
      await notify({ title: "Couldn't prepare the list", message: err.message, tone: "error" });
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDownloadAll() {
    setExportBusy(true);
    try {
      const data = await fetchPrintableRows();
      downloadCredentialsCsv(`${data.className.replace(/\s+/g, "_")}_portal_credentials.csv`, data.rows);
    } catch (err) {
      await notify({ title: "Couldn't prepare the list", message: err.message, tone: "error" });
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open && !revealBatch}
        onClose={onClose}
        size="xl"
        title={`${className || "Class"} — Portal Credentials`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="light" onClick={handleDownloadAll} disabled={exportBusy || loading || !students?.length}>
              <FileDown size={15} />
              Download list
            </Button>
            <Button variant="light" onClick={handlePrintAll} disabled={exportBusy || loading || !students?.length}>
              <Printer size={15} />
              Print list
            </Button>
            <Button
              onClick={handleGenerateClass}
              disabled={bulkBusy || loading || !students?.length}
              title={!loading && !students?.length ? "No active students in this class" : undefined}
            >
              <Users size={15} />
              {bulkBusy ? "Generating…" : "Generate for whole class"}
            </Button>
          </>
        }
      >
        {loading && <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>}
        {error && <p className="text-sm text-red-600 py-6 text-center">{error}</p>}

        {students && !loading && (
          students.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No active students in this class.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto">
              {students.map((s) => (
                <div
                  key={s.studentId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.studentName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Adm. {s.admissionNumber || "—"}</span>
                      <span className="tabular-nums">{s.portalUsername || "No portal account"}</span>
                      {s.hasPortalAccount && (
                        <Badge tone={s.status === "active" ? "pass" : "fail"}>{s.status}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!s.hasPortalAccount ? (
                      <button
                        onClick={() => handleGenerateOne(s.studentId)}
                        disabled={busyId === s.studentId}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                      >
                        Create account
                      </button>
                    ) : (
                      <>
                        {s.mustChangePassword && (
                          <button
                            onClick={() => handlePeek(s.studentId)}
                            disabled={busyId === s.studentId}
                            title="View current temp password"
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleGenerateOne(s.studentId, { isReset: true })}
                          disabled={busyId === s.studentId}
                          title="Reset password"
                          className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s.studentId, s.status)}
                          disabled={busyId === s.studentId}
                          title={s.status === "active" ? "Suspend access" : "Reactivate access"}
                          className={`disabled:opacity-50 ${
                            s.status === "active"
                              ? "text-red-500 hover:text-red-700"
                              : "text-emerald-500 hover:text-emerald-700"
                          }`}
                        >
                          {s.status === "active" ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </Modal>

      <Modal
        open={!!revealBatch}
        onClose={() => setRevealBatch(null)}
        title="Login details — write these down now"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                openCredentialsPrintWindow(
                  `${className || "Class"} — New Portal Credentials`,
                  revealBatch.map((c) => ({ ...c, admissionNumber: c.admissionNumber || "" }))
                )
              }
            >
              <Printer size={15} />
              Print
            </Button>
            <Button onClick={() => setRevealBatch(null)}>Done</Button>
          </>
        }
      >
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          These temporary passwords can only be viewed again until the student changes them. Print or share this now.
        </p>
        <div className="flex flex-col gap-2">
          {revealBatch?.map((c) => (
            <div key={c.studentId} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800 text-sm">{c.studentName}</div>
                <div className="text-xs text-slate-400">Portal ID: {c.portalUsername}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Temp password</div>
                <div className="font-mono font-semibold text-slate-800">{c.tempPassword}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
