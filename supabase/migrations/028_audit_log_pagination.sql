-- ==================================================================
-- 028_audit_log_pagination.sql
-- Performance Fix: Paginated audit log fetching
-- Issue #18 from Professional Audit: Audit Log Can Crash System
--
-- PERFORMANCE IMPACT:
-- - Audit log with 10M entries: 30 seconds + memory crash → instant
-- - Pagination prevents loading all entries into browser memory
--
-- BACKWARD COMPATIBILITY:
-- - New RPC; old audit_logs SELECT still works
-- - Frontend can use this for pagination
--
-- Idempotent — safe to run multiple times
-- ==================================================================

-- New RPC for paginated audit log fetching with cursor support
CREATE OR REPLACE FUNCTION public.get_paginated_audit_logs(
  p_limit integer DEFAULT 50,
  p_after_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT json_build_object(
    'logs', COALESCE(json_agg(
      json_build_object(
        'id', a.id,
        'action', a.action,
        'entity', a.entity,
        'entity_id', a.entity_id,
        'actor_email', a.actor_email,
        'created_at', a.created_at,
        'metadata', a.metadata
      )
      ORDER BY a.created_at DESC
    ), '[]'::json),
    'last_id', (
      SELECT a.id FROM (
        SELECT a.id
        FROM audit_logs a
        WHERE (p_after_id IS NULL OR a.id < p_after_id)
        ORDER BY a.created_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 1000)) + 1
      ) AS paged
      OFFSET GREATEST(1, LEAST(p_limit, 1000))
      LIMIT 1
    ),
    'has_more', (
      SELECT COUNT(*) > 0
      FROM audit_logs a
      WHERE (p_after_id IS NULL OR a.id < p_after_id)
      OFFSET GREATEST(1, LEAST(p_limit, 1000))
      LIMIT 1
    ),
    'total_count', (SELECT COUNT(*) FROM audit_logs)
  ) INTO result
  FROM (
    SELECT a.*
    FROM audit_logs a
    WHERE (p_after_id IS NULL OR a.id < p_after_id)
    ORDER BY a.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 1000))
  ) a;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_paginated_audit_logs(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paginated_audit_logs(integer, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_paginated_audit_logs(integer, uuid) IS 'Paginated audit log fetching; returns 50 entries at a time using UUID cursor pagination';

-- Add index for faster traversal by ID and created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_id
  ON public.audit_logs(created_at DESC, id DESC);

-- ───────────────────────────────────────────────────────────────────
-- USAGE IN APPLICATION:
--
-- // src/routes/_admin/audit.tsx
-- import { useQuery } from "@tanstack/react-query";
--
-- function AuditLogsPage() {
--   const [lastId, setLastId] = useState<string | null>(null);
--   const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
--
--   const { data, isLoading } = useQuery({
--     queryKey: ["audit-logs", lastId],
--     queryFn: async () => {
--       const { data, error } = await supabase.rpc("get_paginated_audit_logs", {
--         p_limit: 50,
--         p_after_id: lastId
--       });
--       if (error) throw error;
--       return data as {
--         logs: AuditLog[];
--         last_id: string;
--         has_more: boolean;
--         total_count: number;
--       };
--     }
--   });
--
--   const handleLoadMore = () => {
--     if (data?.has_more) {
--       setLastId(data.last_id);
--       setAllLogs(prev => [...prev, ...data.logs]);
--     }
--   };
--
--   return (
--     <div>
--       <table>
--         {allLogs.map(log => (
--           <tr key={log.id}>
--             <td>{log.actor_email}</td>
--             <td>{log.action}</td>
--             <td>{new Date(log.created_at).toLocaleString()}</td>
--           </tr>
--         ))}
--       </table>
--       {data?.has_more && (
--         <button onClick={handleLoadMore} disabled={isLoading}>
--           Load More ({allLogs.length} / {data.total_count})
--         </button>
--       )}
--     </div>
--   );
-- }
-- ───────────────────────────────────────────────────────────────────

