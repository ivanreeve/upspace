-- 1. get_admin_dashboard_metrics()
-- Consolidates 8 aggregation queries into a single jsonb result.
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  WITH booking_counts AS (
    SELECT
      count(*)::int                                      AS total,
      jsonb_agg(jsonb_build_object('status', sub.status::text, 'count', sub.cnt))
        AS status_counts
    FROM (
      SELECT status, count(*)::int AS cnt
      FROM booking
      GROUP BY status
    ) sub
  ),
  space_counts AS (
    SELECT
      count(*)::int                                    AS total,
      count(*) FILTER (WHERE is_published)::int        AS published
    FROM space
  ),
  client_counts AS (
    SELECT
      count(*)::int                                                          AS total,
      count(*) FILTER (WHERE status = 'active')::int                         AS active,
      count(*) FILTER (WHERE status = 'deactivated')::int                    AS deactivated,
      count(*) FILTER (WHERE status = 'pending_deletion')::int               AS pending_deletion,
      count(*) FILTER (WHERE status = 'deleted')::int                        AS deleted,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int   AS new_last_7_days
    FROM "user"
    WHERE role = 'customer'
  ),
  verification_counts AS (
    SELECT
      count(*)::int                                      AS total,
      jsonb_agg(jsonb_build_object('status', sub.status::text, 'count', sub.cnt))
        AS status_counts
    FROM (
      SELECT status, count(*)::int AS cnt
      FROM verification
      GROUP BY status
    ) sub
  ),
  revenue AS (
    SELECT
      coalesce(sum(amount_minor), 0)::text  AS total_minor,
      count(*)::int                         AS transaction_count
    FROM payment_transaction
    WHERE status = 'succeeded'
  )
  SELECT jsonb_build_object(
    'revenue', jsonb_build_object(
      'totalMinor',        r.total_minor,
      'transactionCount',  r.transaction_count
    ),
    'bookings', jsonb_build_object(
      'total',        b.total,
      'statusCounts', coalesce(b.status_counts, '[]'::jsonb)
    ),
    'spaces', jsonb_build_object(
      'total',       s.total,
      'published',   s.published,
      'unpublished', greatest(s.total - s.published, 0)
    ),
    'clients', jsonb_build_object(
      'total',           c.total,
      'active',          c.active,
      'deactivated',     c.deactivated,
      'pendingDeletion', c.pending_deletion,
      'deleted',         c.deleted,
      'newLast7Days',    c.new_last_7_days
    ),
    'verifications', jsonb_build_object(
      'total',        v.total,
      'statusCounts', coalesce(v.status_counts, '[]'::jsonb)
    )
  )
  FROM booking_counts b,
       space_counts   s,
       client_counts  c,
       verification_counts v,
       revenue        r;
$$;


-- 2. get_space_ratings_batch(uuid[])
-- Returns (space_id, average_rating, total_reviews) for a batch of space IDs.
CREATE OR REPLACE FUNCTION get_space_ratings_batch(p_space_ids uuid[])
RETURNS TABLE (
  space_id       uuid,
  average_rating double precision,
  total_reviews  int
)
LANGUAGE sql STABLE
AS $$
  SELECT
    r.space_id,
    coalesce(avg(r.rating_star), 0)::double precision  AS average_rating,
    count(*)::int                                       AS total_reviews
  FROM review r
  WHERE r.space_id = ANY(p_space_ids)
  GROUP BY r.space_id;
$$;


-- 3. get_user_bookmarks_batch(uuid, uuid[])
-- Resolves a Supabase auth user ID to the internal user_id AND fetches
-- their bookmarks for the given space IDs in a single round-trip.
CREATE OR REPLACE FUNCTION get_user_bookmarks_batch(
  p_auth_user_id uuid,
  p_space_ids    uuid[]
)
RETURNS TABLE (
  db_user_id bigint,
  space_id   uuid
)
LANGUAGE sql STABLE
AS $$
  SELECT
    u.user_id  AS db_user_id,
    bk.space_id
  FROM "user" u
  LEFT JOIN bookmark bk
    ON bk.user_id = u.user_id
   AND bk.space_id = ANY(p_space_ids)
  WHERE u.auth_user_id = p_auth_user_id;
$$;
