## What I found

Your backup file contains **460 member records**, of which **388 are active** (not expired, none frozen). Two things in the restore tool are dropping most of them:

1. **The "already exists" check counts deleted members.** Your database currently holds **1,808 member rows that are all in Recently Deleted** (from the earlier resets). The restore preview checks phone numbers against *every* row in the table, including deleted ones — so almost every record in your file is judged "already exists in database" and skipped. That is the main reason only a fraction came in.
2. **Shared phone numbers get dropped.** 23 phone numbers appear on more than one member in the file (family/shared numbers). The restore keeps only the first of each, silently removing 24 records — 18 of them active. So even a clean restore would give 370 active, not 388.

Two smaller gaps: the restore also ignores `frozen_at` and the original join date (`created_at`), and it inserts all rows in one request, which is fragile for large files.

## Fix

Edit `src/routes/_authenticated/settings.tsx` (restore logic only, no schema changes):

1. **Ignore deleted rows when detecting existing members** — add `deleted_at is null` to the phone lookup, and fetch it in chunks so the 1,000-row response cap can't silently shorten the list.
2. **Stop treating a repeated phone as a duplicate.** Only flag a record as a duplicate when name + phone + expiry date all match another record in the file. Shared numbers with different people are imported normally.
3. **Preserve original data** — carry over `frozen_at` and the original `created_at` so the member's real join date and frozen state survive the restore.
4. **Insert in batches of 200** with a running count, so a 460-record file restores reliably and the audit result reports the true inserted count.
5. **Preview accuracy** — the preview line and Restore button will now show the real number (expected: 460 read, 0 already-in-database, ~0 duplicates, 460 to insert), and the audit log keeps listing every skipped record with the reason.

## Before you restore

The 1,808 deleted member rows stay in Recently Deleted for 30 days. After this fix they no longer block the restore, so you can leave them alone — but if you want a truly clean table, tell me and I'll add a "permanently clear deleted members" action for admins.
