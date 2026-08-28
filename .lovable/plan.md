# Fix the 389 vs 388 active-member count

## What I found

The new app's count is not miscalculated — it matches the data exactly. There are currently 460 live member records, of which 388 satisfy the active rule (not deleted, not frozen, expiry today or later)... except that one person is stored twice:

- BEENSIGAR SELVAN, phone 8884972987
  - Row A: joined 2026-02-20, expires 2027-02-20
  - Row B: joined 2026-02-24, expires 2027-02-24

Both rows came in from the old software's own backup file (two separate records with different IDs, plus two "joined" activity entries for the same person minutes apart). The old software showed 388 because it collapsed this person into one; the restore kept both rows because the earlier duplicate rule only treats records as identical when name, phone AND expiry date all match — here the dates differ by 4 days.

So this is a single duplicated person, not a systemic import error.

## Proposed fix

1. Keep the newer, higher-value record (12 Months, 10,000 paid, expires 2027-02-24) and soft-delete the older 2026-02-20 record with reason "duplicate record from legacy import". Soft delete means it stays recoverable for 30 days in Settings → Recently deleted, and the dashboard drops to 388.
2. Add a "Possible duplicates" check to the restore preview: after matching on exact name+phone+expiry, also flag records that share name + phone with expiry dates within 30 days of each other, listed as "possible duplicate — review" so future imports surface these instead of silently inserting both.
3. Add a small "Find duplicate members" action in Settings → Backup & restore that lists live members sharing name + phone, with a button to soft-delete the older record of each pair. This makes the same cleanup repeatable without database access.

## Technical notes

- Cleanup of the single duplicate is done via a migration that sets `deleted_at`, `deleted_reason` on the older row (id `...` matched by name/phone/expiry), so it flows through the existing soft-delete + Recently deleted UI.
- Restore preview changes live in `src/routes/_authenticated/settings.tsx`, in the same grouping pass that currently builds the "identical record repeated" bucket; the new bucket is advisory only and defaults to not inserting the flagged extra row (user can override with Force insert).
- Duplicate finder is a client-side query on `members` (name, phone, start/expiry) grouped in JS, reusing the existing soft-delete helper.
- No change to the active-member rule itself: `deleted_at IS NULL AND frozen_at IS NULL AND expiry_date >= today`.
