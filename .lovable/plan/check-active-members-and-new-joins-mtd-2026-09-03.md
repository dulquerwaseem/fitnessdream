# Check: Active members and New joins (MTD)

## Active members — correct

The card counts members that are not deleted, not frozen, and whose expiry date is today or later. Running the same rule directly against the database returns exactly the number the card shows (384 right now), so nothing to fix.

## New joins (MTD) — counting the wrong date

The card counts members whose *membership start date* falls in the current month. That is not the same as "joined this month", and right now it returns 6 records that include:

- Rachitha — start date 15 Sep 2026, a **future** start date; counted as a new join already.
- Tryphosa, Ajay, Bharath, Harsha — all **added in August** with a 1 Sep membership start; they inflate September.
- Mohammed Ismail — the only member actually added this month.

So the true "new joins this month" is 1, while the card says 6.

## Proposed fix

Count new joins by when the member record was actually created (the join date shown on the profile), for the current month in local time:

- Dashboard card: count members created between the 1st of this month and now, excluding deleted members.
- Members list "New joins (this month)" filter: use the same rule so the list matches the card exactly (today it filters by start date, so clicking the card shows a different set than the number implied).

Nothing else about member status, expiry, or freezing changes.

## Technical notes

- `src/routes/_authenticated/dashboard.tsx`: replace the `gte("start_date", monthStartDate)` join count with `gte("created_at", <local month start as ISO timestamp>)`.
- `src/routes/_authenticated/members.index.tsx`: in the `new_mtd` branch, filter on `created_at` with the same month-start timestamp instead of `start_date`.
- Month start is computed in local time (existing `localISO` helper pattern) so IST does not shift the boundary.
