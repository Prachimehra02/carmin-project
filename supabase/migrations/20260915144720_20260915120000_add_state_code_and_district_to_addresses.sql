/*
# Add state_code and district to addresses table

## Purpose
Phase 1 of address validation: store the validated state code and district
alongside each saved address so they can later be used for GST calculation
(intra-state vs inter-state determination).

## Changes
1. Add `state_code` (text, nullable) to `addresses` — stores the 2-letter
   Indian state/UT code (e.g. 'MH', 'DL', 'KA') from PIN code lookup.
2. Add `district` (text, nullable) to `addresses` — stores the district name
   from PIN code lookup.

Both columns are nullable so existing saved addresses continue to work
without requiring a migration backfill.

## Security
No RLS policy changes. Existing policies remain intact.
*/
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS state_code text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS district text;
