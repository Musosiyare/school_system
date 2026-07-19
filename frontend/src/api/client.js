import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

// A logged-in manager/teacher session can be cut off by maintenance mode
// turning on mid-session — any protected call can come back 503
// MAINTENANCE_MODE at any time. MaintenanceProvider registers a handler here
// on mount so this plain module (outside the React tree) can notify it.
let maintenanceHandler = null;
export function setMaintenanceHandler(fn) {
  maintenanceHandler = fn;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Central place to unwrap our standard { error: { code, message, field } } shape
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = err.response?.data?.error;

    if (apiError?.code === "MAINTENANCE_MODE" && maintenanceHandler) {
      maintenanceHandler(apiError.message);
    }

    // A 401 here means the session is no longer valid (expired, or ended by
    // logout elsewhere). Clear local state and bounce to login rather than
    // leaving the user stuck on a page that will just keep failing.
    if (err.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    if (apiError) {
      const wrapped = new Error(apiError.message || "Something went wrong");
      wrapped.code = apiError.code;
      return Promise.reject(wrapped);
    }
    return Promise.reject(err);
  }
);

export default api;
