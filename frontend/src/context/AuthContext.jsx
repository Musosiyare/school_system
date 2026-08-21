import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // The cached `user` in localStorage is a snapshot from whenever this
  // session last logged in — school details (name, logo) can change
  // afterwards (e.g. a manager uploads a new logo, or it's set for the
  // first time) and a session that logged in before that update never
  // sees it until it re-logs-in. Refresh the school-derived fields from
  // the server once on load so every open session (any role) reflects
  // the current logo/name, not a stale one.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser((prev) => (prev ? { ...prev, ...data.user } : prev));
      })
      .catch(() => {
        // ignore — keep whatever's cached; a real auth failure surfaces
        // on the next protected call via the response interceptor
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identifier, password) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      localStorage.setItem("token", data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    // Tell the server this session is over (invalidates the token immediately,
    // server-side) before clearing local state. If the request fails — e.g. no
    // network — we still log the user out locally rather than trap them.
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — local logout proceeds regardless
    }
    localStorage.removeItem("token");
    setUser(null);
  }

  function updateUser(patch) {
    setUser((prev) => ({ ...prev, ...patch }));
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
