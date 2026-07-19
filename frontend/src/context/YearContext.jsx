import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "./AuthContext";

const YearContext = createContext(null);

// Lets a manager switch which academic year the rest of the app (Classes,
// Students, Reports, Statistics, Dashboard) is showing. Defaults to the
// school's current year. Switching away from it puts those pages into
// read-only mode — the backend already refuses any write against a
// non-current year, this just reflects that in the UI so buttons look
// disabled instead of failing after the fact.
export function YearProvider({ children }) {
  const { user } = useAuth();
  const [years, setYears] = useState([]);
  const [viewingYearId, setViewingYearId] = useState(() => {
    const stored = sessionStorage.getItem("viewingYearId");
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.role !== "manager") return;
    setLoading(true);
    try {
      const { data } = await api.get("/academic-years", { params: { all: true } });
      setYears(data.academicYears || []);
      setViewingYearId((prev) => {
        // If nothing selected yet, or the previously-selected year no
        // longer exists, fall back to whichever year is current.
        const stillValid = prev && data.academicYears.some((y) => y.id === prev);
        if (stillValid) return prev;
        const current = data.academicYears.find((y) => y.isCurrent);
        return current ? current.id : data.academicYears[0]?.id || null;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (viewingYearId) sessionStorage.setItem("viewingYearId", String(viewingYearId));
  }, [viewingYearId]);

  const viewingYear = years.find((y) => y.id === viewingYearId) || null;
  const isCurrentView = !viewingYear || viewingYear.isCurrent;

  return (
    <YearContext.Provider
      value={{
        years,
        viewingYearId,
        viewingYear,
        isCurrentView,
        setViewingYearId,
        loading,
        refreshYears: load,
      }}
    >
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  return useContext(YearContext);
}
