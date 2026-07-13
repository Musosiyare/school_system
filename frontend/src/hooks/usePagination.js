import { useEffect, useMemo, useState } from "react";

/**
 * Client-side pagination for an already-loaded (and already-filtered) array.
 * All the data we paginate here — teachers, students, modules, schools —
 * comes back from the API in one shot, so there's no server-side page/limit
 * to wire up; this just slices what's already in memory.
 *
 * Resets to page 1 whenever the underlying item count changes (e.g. a new
 * search term narrows the list) so you're never stranded on a page that no
 * longer exists.
 */
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    pageSize,
    total: items.length,
  };
}
