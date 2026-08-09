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
export function usePagination(items, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to page 1 whenever the item count changes (e.g. a new search term
  // or filter narrows the list) OR the page size itself changes, so you're
  // never stranded on a page that no longer exists.
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
    setPageSize,
    total: items.length,
  };
}
