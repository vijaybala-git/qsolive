-- ============================================================================
-- Public Club: keep a single "Public Club", remove duplicates
-- Run once in Supabase SQL Editor. Safe to run multiple times.
-- ============================================================================

-- 1. Delete duplicate "Public Club" rows, keeping the one with earliest created_at
DELETE FROM public.clubs
WHERE name = 'Public Club'
  AND id <> (
    SELECT id FROM public.clubs
    WHERE name = 'Public Club'
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1
  );

-- 2. If no "Public Club" exists, insert one (e.g. after manual delete)
INSERT INTO public.clubs (name, description)
SELECT 'Public Club', 'Default group for new operators'
WHERE NOT EXISTS (SELECT 1 FROM public.clubs WHERE name = 'Public Club');
