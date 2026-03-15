-- ============================================================================
-- Prevent duplicate contacts (same QSO: operator, contacted, date, time, frequency, mode)
-- Use for: UDP client and ADIF upload; same ADIF uploaded twice or both paths.
-- Duplicate = same qso_date + time_on + operator_callsign + contacted_callsign + frequency + mode.
-- ============================================================================

-- 1. Normalize mode so unique key is deterministic (NULL -> '')
UPDATE public.contacts SET mode = '' WHERE mode IS NULL;
ALTER TABLE public.contacts ALTER COLUMN mode SET DEFAULT '';

-- 2. Allow frequency 0 for "unknown" so we can include frequency in the unique key (NULL -> 0)
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS valid_frequency;
ALTER TABLE public.contacts ADD CONSTRAINT valid_frequency
  CHECK (frequency >= 0 AND frequency <= 300000);
UPDATE public.contacts SET frequency = 0 WHERE frequency IS NULL;
ALTER TABLE public.contacts ALTER COLUMN frequency SET DEFAULT 0;
ALTER TABLE public.contacts ALTER COLUMN frequency SET NOT NULL;

-- 3. Remove existing duplicates (keep row with smallest id per key)
DELETE FROM public.contacts c
USING public.contacts c2
WHERE c.operator_callsign = c2.operator_callsign
  AND c.contacted_callsign = c2.contacted_callsign
  AND c.qso_date = c2.qso_date
  AND c.time_on = c2.time_on
  AND COALESCE(c.mode, '') = COALESCE(c2.mode, '')
  AND COALESCE(c.frequency, 0) = COALESCE(c2.frequency, 0)
  AND c.id > c2.id;

-- 4. Unique constraint: one row per (operator, contacted, date, time, mode, frequency)
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_no_duplicate_qso;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_no_duplicate_qso
  UNIQUE (operator_callsign, contacted_callsign, qso_date, time_on, mode, frequency);

COMMENT ON CONSTRAINT contacts_no_duplicate_qso ON public.contacts IS
  'Prevent duplicate QSOs: same operator, contacted call, date, time, mode, frequency (UDP + ADIF upload).';

