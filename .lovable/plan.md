## Goal

Let the restore action insert every valid row from the JSON backup, bypassing the "already exists in database" and "duplicate phone in file" skips, so the user can bring in all 363 records and clean up duplicates afterward.

## Change

Edit `src/routes/_authenticated/settings.tsx` only. No schema or business-logic changes elsewhere.

1. Add a **"Force insert all (ignore duplicates)"** checkbox inside the restore preview alert (next to the Restore/Cancel buttons).
2. When checked:
   - The insert set becomes every valid row (`toAdd` + `toUpdate` + `dupInFile`), i.e. all 363 minus rows with missing name/phone.
   - The Restore button label updates live to `Restore N members` reflecting that count.
   - Rows still get `phone_normalized` computed the same way; nothing else in the row mapping changes.
3. The audit log after the run reports what was actually inserted vs. what was force-inserted-despite-existing / force-inserted-despite-dup-in-file, so the user can find the duplicates to clean up later.
4. Unchecked behavior is unchanged (current dedup preview + insert).

## Notes

- The `members` table has no unique constraint on `phone_normalized`, so duplicate inserts will succeed and create real duplicate rows — that matches the user's stated intent ("restore as-is, correct later").
- No changes to dashboard stats, RLS, or the leads module.
