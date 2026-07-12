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
