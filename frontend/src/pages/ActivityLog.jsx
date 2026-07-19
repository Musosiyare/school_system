import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import { IconSelect, Input } from "../components/ui/FormField";
import { ErrorText } from "../components/ui/Alerts";
import {
  History,
  UserPlus,
  UserCog2,
  UserMinus,
  ShieldOff,
  ShieldCheck,
  Layers,
  PencilLine,
  Trash2,
  ClipboardList,
  FileSpreadsheet,
  Activity,
  Filter,
  KeyRound,
  UserCog,
  Mail,
} from "lucide-react";

// One icon + accent color per action code, so the list reads at a glance
// without having to parse the description text. Falls back to a neutral
// "Activity" icon for anything not explicitly mapped here (e.g. an action
// added later that this page hasn't been updated for yet).
const ACTION_META = {
  "student.created": { label: "Student added", icon: UserPlus, tone: "text-emerald-600 bg-emerald-50" },
  "student.updated": { label: "Student updated", icon: UserCog2, tone: "text-brand-600 bg-brand-50" },
  "student.deleted": { label: "Student deleted", icon: UserMinus, tone: "text-rose-600 bg-rose-50" },
  "class.created": { label: "Class created", icon: Layers, tone: "text-emerald-600 bg-emerald-50" },
  "class.renamed": { label: "Class renamed", icon: PencilLine, tone: "text-brand-600 bg-brand-50" },
  "class.deleted": { label: "Class deleted", icon: Trash2, tone: "text-rose-600 bg-rose-50" },
  "class.teacher_assigned": { label: "Class teacher assigned", icon: ClipboardList, tone: "text-brand-600 bg-brand-50" },
  "class.teacher_unassigned": { label: "Class teacher removed", icon: ClipboardList, tone: "text-amber-600 bg-amber-50" },
  "marks.recorded": { label: "Marks recorded", icon: PencilLine, tone: "text-brand-600 bg-brand-50" },
  "marks.imported": { label: "Marks imported", icon: FileSpreadsheet, tone: "text-brand-600 bg-brand-50" },
  "teacher.created": { label: "Teacher added", icon: UserPlus, tone: "text-emerald-600 bg-emerald-50" },
  "teacher.deleted": { label: "Teacher deleted", icon: UserMinus, tone: "text-rose-600 bg-rose-50" },
  "teacher.activated": { label: "Teacher activated", icon: ShieldCheck, tone: "text-emerald-600 bg-emerald-50" },
  "teacher.deactivated": { label: "Teacher deactivated", icon: ShieldOff, tone: "text-amber-600 bg-amber-50" },
  "teacher.password_reset": { label: "Teacher password reset", icon: KeyRound, tone: "text-brand-600 bg-brand-50" },
  "account.password_changed": { label: "Password changed", icon: KeyRound, tone: "text-brand-600 bg-brand-50" },
  "account.name_updated": { label: "Name updated", icon: UserCog, tone: "text-brand-600 bg-brand-50" },
  "account.email_updated": { label: "Login email updated", icon: Mail, tone: "text-brand-600 bg-brand-50" },
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Which action types each role can filter by — mirrors what each role's
// routes actually allow (see studentRoutes/classRoutes/markRoutes/
// Which action types each role can filter by. This is deliberately based on
// what each role's UI actually lets them do — not just what the backend
// route technically authorizes. For example, POST /marks allows both
// "teacher" and "manager" server-side, but managers have no "Record Marks"
// page in their nav at all (only teachers do), so marks actions never
// really happen under a manager's account and shouldn't appear as a filter
// option for one. Likewise a teacher never creates/deletes a teacher
// account, so those stay manager-only here.
const ROLE_ACTIONS = {
  manager: [
    "student.created",
    "student.updated",
    "student.deleted",
    "class.created",
    "class.renamed",
    "class.deleted",
    "class.teacher_assigned",
    "class.teacher_unassigned",
    "teacher.created",
    "teacher.deleted",
    "teacher.activated",
    "teacher.deactivated",
    "teacher.password_reset",
    "account.password_changed",
    "account.name_updated",
  ],
  teacher: ["marks.recorded", "marks.imported", "account.password_changed", "account.name_updated"],
  superuser: ["account.password_changed", "account.name_updated", "account.email_updated"],
};

const PAGE_SIZE = 8;

export default function ActivityLog() {
  const { user } = useAuth();
  const allowedActions = ROLE_ACTIONS[user?.role] || [];

  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Any filter change resets to page 1 — staying on e.g. page 5 of a
  // brand-new, smaller filtered result would just show an empty page.
  useEffect(() => {
    setPage(1);
  }, [query, action, from, to]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/activity-logs", {
          params: {
            page,
            limit: PAGE_SIZE,
            q: query || undefined,
            action: action || undefined,
            from: from || undefined,
            to: to || undefined,
          },
        });
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    // Small debounce so typing in the search box doesn't fire a request
    // per keystroke — date/action filters change less often so this only
    // meaningfully delays the search-text case.
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [page, query, action, from, to]);

  const hasFilters = query || action || from || to;

  return (
    <Card>
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search activity..."
          className="w-full lg:w-64"
        />
        {allowedActions.length > 0 && (
          <IconSelect icon={Filter} value={action} onChange={(e) => setAction(e.target.value)} className="lg:w-56">
            <option value="">All action types</option>
            {allowedActions.map((code) => (
              <option key={code} value={code}>
                {ACTION_META[code].label}
              </option>
            ))}
          </IconSelect>
        )}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="lg:w-40" />
        <span className="text-xs text-slate-400 hidden lg:block">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="lg:w-40" />
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-10">
          <History className="mx-auto text-slate-300" size={32} />
          <p className="text-sm text-slate-400 mt-2">
            {hasFilters ? "No activity matches these filters." : "No activity recorded yet."}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => {
              const meta = ACTION_META[log.action] || { icon: Activity, tone: "text-slate-500 bg-slate-100" };
              const Icon = meta.icon;
              return (
                <li key={log.id} className="flex items-start gap-3 py-3">
                  <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${meta.tone}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 leading-relaxed">{log.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(log.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} pageSize={PAGE_SIZE} />
        </>
      )}
    </Card>
  );
}
