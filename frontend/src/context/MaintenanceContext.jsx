import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { setMaintenanceHandler } from "../api/client";

const MaintenanceContext = createContext(null);

const DEFAULTS = {
  maintenanceMode: false,
  title: "",
  message: "",
  updatedByName: null,
  updatedAt: null,
  scheduledAt: null,
  scheduleAnnouncement: "",
  checked: false, // becomes true once we've heard back from the server at least once
};

// Polling interval for the public status check — catches the case where
// maintenance mode gets switched on/off (including an auto-applied schedule
// kicking in) while someone is just sitting on a page without making any
// other API calls.
const POLL_MS = 20000;

export function MaintenanceProvider({ children }) {
  const [status, setStatus] = useState(DEFAULTS);
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/maintenance");
      setStatus({
        maintenanceMode: !!data.maintenanceMode,
        title: data.title || "",
        message: data.message || "",
        updatedByName: data.updatedByName || null,
        updatedAt: data.updatedAt || null,
        scheduledAt: data.scheduledAt || null,
        scheduleAnnouncement: data.scheduleAnnouncement || "",
        checked: true,
      });
    } catch {
      // Public endpoint failing (e.g. offline) shouldn't lock anyone out of
      // the app — just leave whatever status we last knew about in place.
      setStatus((s) => ({ ...s, checked: true }));
    }
  }, []);

  useEffect(() => {
    refresh();

    // Any API call anywhere can also discover maintenance mode turned on
    // mid-session (via a 503), which should reflect here immediately rather
    // than waiting for the next poll.
    setMaintenanceHandler((message) => {
      setStatus((s) => ({ ...s, maintenanceMode: true, message: message || s.message, checked: true }));
    });

    intervalRef.current = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(intervalRef.current);
      setMaintenanceHandler(null);
    };
  }, [refresh]);

  return (
    <MaintenanceContext.Provider value={{ ...status, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  return useContext(MaintenanceContext);
}
