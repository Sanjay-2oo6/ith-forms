/**
 * Cursor-Based Pagination Hook
 *
 * Implements efficient cursor-based pagination for large datasets.
 * Unlike offset pagination (skip 1000, fetch 50 = slow on large tables),
 * cursor pagination uses index seek: "fetch rows after cursor" (fast always).
 *
 * Usage:
 * ```
 * const { rows, isLoading, hasMore, loadMore } = usePagination(
 *   ["forms-list"],
 *   async (cursor, limit) => {
 *     const { data } = await supabase
 *       .from("forms")
 *       .select("id, title")
 *       .order("id", { ascending: false })
 *       .limit(limit)
 *       .gt("id", cursor || "");
 *     return data || [];
 *   },
 *   50 // items per page
 * );
 *
 * return (
 *   <>
 *     {rows.map(item => <Item key={item.id} {...item} />)}
 *     {hasMore && <button onClick={loadMore}>Load More</button>}
 *   </>
 * );
 * ```
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface UsePaginationOptions {
  initialLimit?: number;
  initialCursor?: string | null;
}

interface UsePaginationResult<T> {
  /** All rows loaded so far (accumulating) */
  rows: T[];
  /** Loading indicator for current page */
  isLoading: boolean;
  /** True if more rows are available to load */
  hasMore: boolean;
  /** Load next page of results */
  loadMore: () => void;
  /** Reset pagination to beginning */
  reset: () => void;
}

export function usePagination<T extends { id: string }>(
  queryKey: (string | number)[],
  queryFn: (cursor: string | null, limit: number) => Promise<T[]>,
  limit: number = 50,
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { initialLimit = limit, initialCursor = null } = options;

  // State: current cursor position and all accumulated rows
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [allRows, setAllRows] = useState<T[]>([]);

  // Query for current page
  const { data: currentRows = [], isLoading } = useQuery({
    queryKey: [...queryKey, cursor],
    queryFn: () => queryFn(cursor, initialLimit),
    enabled: cursor !== undefined, // Don't fetch if cursor is still initializing
  });

  // On first load (cursor === null), just use currentRows
  // On subsequent loads, append to allRows
  const displayRows =
    cursor === null && allRows.length === 0 ? currentRows : allRows;

  // Check if there are more rows: if currentRows.length < limit, we've reached the end
  const hasMore = currentRows.length === initialLimit;

  const loadMore = () => {
    if (!hasMore || currentRows.length === 0) return;

    // Next cursor is the last item's ID we just loaded
    const lastRow = currentRows[currentRows.length - 1];

    // Add current page to accumulated rows
    setAllRows((prev) => [...prev, ...currentRows]);

    // Move cursor forward
    setCursor(lastRow.id);
  };

  const reset = () => {
    setCursor(null);
    setAllRows([]);
  };

  return {
    rows: displayRows,
    isLoading,
    hasMore,
    loadMore,
    reset,
  };
}

/**
 * Alternative: Offset-Based Pagination Hook
 *
 * Simpler but slower on large tables. Use when:
 * - Dataset is small (<10k rows)
 * - You need random access ("jump to page 5")
 * - You're comfortable with O(n) performance
 *
 * Usage:
 * ```
 * const { rows, page, total, goToPage, nextPage, prevPage } = useOffsetPagination(
 *   ["forms-list"],
 *   async (offset, limit) => {
 *     const { data, count } = await supabase
 *       .from("forms")
 *       .select("*", { count: "exact" })
 *       .range(offset, offset + limit - 1);
 *     return { rows: data || [], total: count || 0 };
 *   },
 *   50
 * );
 * ```
 */

interface UseOffsetPaginationResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  isLoading: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function useOffsetPagination<T>(
  queryKey: (string | number)[],
  queryFn: (
    offset: number,
    limit: number
  ) => Promise<{ rows: T[]; total: number }>,
  limit: number = 50
): UseOffsetPaginationResult<T> {
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => queryFn(page * limit, limit),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / limit);

  return {
    rows,
    page,
    pageSize: limit,
    total,
    pageCount,
    isLoading,
    goToPage: (p) => setPage(Math.max(0, Math.min(p, pageCount - 1))),
    nextPage: () => setPage((p) => Math.min(p + 1, pageCount - 1)),
    prevPage: () => setPage((p) => Math.max(p - 1, 0)),
  };
}
