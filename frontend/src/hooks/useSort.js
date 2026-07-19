import { useMemo, useState } from "react";

// Generic client-side sort for a list already filtered/loaded into memory.
// `accessors` maps a sortKey (matching what you pass to SortableTh) to a
// function that pulls the comparable value out of an item — e.g.
// { name: (t) => t.name, teaching: (t) => assignmentsFor(t.id).length }.
// Strings sort case-insensitively via localeCompare; numbers/dates sort
// numerically; null/undefined values always sort to the end regardless of
// direction, so incomplete data doesn't jump to the top on "asc".
export function useSort(items, accessors, initialKey = null, initialDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const sorted = useMemo(() => {
    if (!sortKey || !accessors[sortKey]) return items;
    const getValue = accessors[sortKey];
    const withValues = items.map((item) => ({ item, value: getValue(item) }));
    withValues.sort((a, b) => {
      const aNull = a.value == null;
      const bNull = b.value == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1; // nulls always last, regardless of direction
      if (bNull) return -1;
      const cmp =
        typeof a.value === "string"
          ? a.value.localeCompare(b.value)
          : a.value < b.value
          ? -1
          : a.value > b.value
          ? 1
          : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withValues.map((x) => x.item);
  }, [items, sortKey, sortDir, accessors]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sorted, sort: { key: sortKey, dir: sortDir }, toggleSort };
}
