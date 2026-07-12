import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Layers, BookOpen, CalendarRange } from "lucide-react";
import api from "../api/client";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);

  async function load() {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // Light polling so a reminder shows up without a manual refresh.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      load(); // fall back to server truth if the optimistic update was wrong
    }
  }

  async function markAllRead() {
    setNotifications([]);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      load();
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">You're all caught up.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 transition
                    ${n.isRead ? "bg-white" : "bg-brand-50/60 hover:bg-brand-50"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-700 leading-relaxed">
                        {n.message.split("\n").map((line, i) => {
                          if (line.trim() === "") return <div key={i} className="h-2" />;
                          // Reminder lines look like "• Module Name (3/30 missing)" —
                          // bold just the module name, not the whole message.
                          const bulletMatch = line.match(/^• (.+?)(\s\(.*\))$/);
                          if (bulletMatch) {
                            return (
                              <div key={i}>
                                • <span className="font-semibold text-slate-800">{bulletMatch[1]}</span>
                                {bulletMatch[2]}
                              </div>
                            );
                          }
                          return <div key={i}>{line}</div>;
                        })}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
                        <span>From {n.sender?.name || "—"}</span>
                        {n.Class && (
                          <span className="flex items-center gap-0.5">
                            <Layers size={10} /> {n.Class.name}
                          </span>
                        )}
                        {n.Module && (
                          <span className="flex items-center gap-0.5">
                            <BookOpen size={10} /> {n.Module.moduleTitle}
                          </span>
                        )}
                        {n.Term && (
                          <span className="flex items-center gap-0.5">
                            <CalendarRange size={10} /> {n.Term.name}
                          </span>
                        )}
                        <span>· {timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
