import { useState } from "react";
import { AlertTriangle, CalendarClock, Power } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMaintenance } from "../context/MaintenanceContext";
import { useConfirm } from "./ui/ConfirmProvider";
import api from "../api/client";

function formatWhen(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Rendered inside Layout, above the page content, on every authenticated
// page. Two distinct jobs:
//   - Superuser + mode ON: an impossible-to-miss reminder that it's still on,
//     with a one-click way to turn it off — the whole reason this exists is
//     "in case I forgot", so it has to follow them to every page, not just
//     sit on the dashboard.
//   - Manager/teacher + a schedule is pending: a heads-up before it locks
//     them out automatically, so they can wrap up / save what they're doing.
export default function MaintenanceBanner() {
  const { user } = useAuth();
  const { maintenanceMode, scheduledAt, scheduleAnnouncement, title, message, refresh } = useMaintenance();
  const confirm = useConfirm();
  const [turningOff, setTurningOff] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user) return null;
  const isSuperuser = user.role === "superuser";

  if (isSuperuser && maintenanceMode) {
    async function turnOff() {
      const ok = await confirm({
        title: "Turn off maintenance mode?",
        message: "Every manager and teacher will regain access immediately.",
        confirmText: "Turn it off",
      });
      if (!ok) return;
      setTurningOff(true);
      try {
        await api.patch("/settings/maintenance", { maintenanceMode: false, title, message });
        await refresh();
      } finally {
        setTurningOff(false);
      }
    }

    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-3">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-500 text-white shadow-sm px-4 py-2.5 text-xs font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="flex-1 min-w-0">
            Maintenance mode is ON — every manager and teacher is currently locked out.
          </span>
          <button
            onClick={turnOff}
            disabled={turningOff}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            <Power size={12} />
            {turningOff ? "Turning off..." : "Turn it off now"}
          </button>
        </div>
      </div>
    );
  }

  if (dismissed || !scheduledAt) return null;

  if (isSuperuser) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-3">
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 shadow-sm px-4 py-2.5 text-xs">
          <CalendarClock size={15} className="shrink-0" />
          <span className="flex-1 min-w-0">
            Maintenance is planned to start on {formatWhen(scheduledAt)} — remember to switch it on yourself when the time comes.
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-xs font-medium text-violet-500 hover:text-violet-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 shadow-sm px-4 py-2.5 text-xs">
        <CalendarClock size={15} className="shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="font-medium">Upcoming maintenance:</span> the system is expected to go
          offline starting {formatWhen(scheduledAt)}.{scheduleAnnouncement ? ` ${scheduleAnnouncement}` : ""}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-medium text-amber-600 hover:text-amber-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
