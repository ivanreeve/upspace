# Marketplace Performance Optimization Plan

## Goal
Reduce marketplace initial load latency and improve repeat visit performance on Vercel by addressing server-side bottlenecks (Prisma + Supabase + cache) and client refetch behavior.

## Quick Diagnosis Summary (from code review)
- Redis cache is never hit because `setSpacesListCache` writes a hash, but `readSpacesListCache` reads with GET.
- `/api/v1/spaces` does multiple sequential calls per request: Prisma `findMany`, Supabase signed URLs, review `groupBy`, bookmark lookup, and Supabase auth lookup.
- Search filter `q` uses `contains` across multiple columns, likely missing pg_trgm indexes.
- Client list query uses `cache: 'no-store'` and default React Query refetch behavior.

## Phase 0: Measure (baseline)
1. Add request timing logs around each step in `GET /api/v1/spaces`:
   - Prisma `findMany`
   - `resolveSignedImageUrls`
   - Review `groupBy`
   - Bookmark lookup
   - Supabase `auth.getUser`
2. Log whether cache is hit/miss and total response time.
3. Capture p50/p95 latency from Vercel logs for 1-2 days.

## Phase 1: Immediate Fixes (highest impact)
1. Fix Redis cache mismatch:
   - Either store cache as string with `SET`, or read hash via `HGET`.
   - Use payload field consistently (`payload`).
2. Parallelize independent calls after `findMany`:
   - `resolveSignedImageUrls`, `review.groupBy`, and bookmark lookup can run in `Promise.all`.
3. Reduce Supabase auth lookup for anonymous users:
   - Short-circuit earlier if request has no auth cookie / header.

## Phase 2: Query and Payload Slimming
1. Limit include/fields returned from Prisma to only what is rendered in marketplace cards.
2. Consider removing `space_availability` from the list endpoint (load per detail page only).
3. If signed URLs are needed, add a short-lived public URL cache on the server or use public buckets.

## Phase 3: Database Indexing
1. Add pg_trgm indexes for text search columns used in `q`:
   - `space.name`, `space.street`, `space.address_subunit`, `space.unit_number`, `space.city`, `space.region`, `space.country_code`, `space.postal_code`.
2. Confirm indexes for filter columns used in list queries:
   - `city`, `region`, `barangay`, `country_code`, `is_published`, `verification.status`.
3. Analyze query plans (EXPLAIN) after index creation.

## Phase 4: Client-side Refinements
1. Add `staleTime` for marketplace list query (ex: 30-60s).
2. Set `refetchOnWindowFocus: false` for the list query to avoid noisy refetching.
3. Consider pagination or "load more" with smaller default page size when data grows.

## Phase 5: Caching Strategy
1. Keep Redis list cache for anonymous users; short TTL (60s) is fine.
2. Add per-user cache for bookmarks only if needed (or defer bookmark lookup to client).
3. Pre-generate signed URLs during upload and store in DB if possible.

## Success Criteria
- p50 /api/v1/spaces latency < 300ms on warm cache
- p95 /api/v1/spaces latency < 800ms on warm cache
- Cold-start latency improved by at least 30%
- Marketplace page renders first content in < 1.5s on median connection

## Next Steps
- Confirm whether you want me to implement Phase 1 now.
- If yes, I will:
  - Fix Redis cache read/write mismatch
  - Add timing logs (behind env flag)
  - Parallelize independent tasks
