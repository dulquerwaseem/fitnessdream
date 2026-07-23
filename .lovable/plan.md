
# Fitness Dream — Gym Management SaaS

Single-pass build using Lovable Cloud (Supabase) with a premium light-default UI, dark toggle, and fiery orange (#FF5A1F) accent. WhatsApp integration is a `wa.me` deep link (no API).

## Design system

- **Theme**: light default, dark toggle in Settings (persisted to localStorage, applied via `.dark` on `<html>`).
- **Accent**: `--primary` = oklch equivalent of `#FF5A1F`; neutral slate surfaces; both themes premium.
- **Type**: Inter (body) + Space Grotesk (display) loaded via `<link>` in `__root.tsx`, wired in `@theme`.
- **Feel**: card-based, generous whitespace, subtle motion (`animate-fade-in`, `animate-scale-in`, `hover-scale`), skeleton loaders on every list/detail, empty states with a CTA.
- **Layout**: shadcn sidebar (collapsible-icon) + top bar with search, theme toggle, user menu. Fully responsive; sidebar becomes off-canvas on mobile.

## Data model (Lovable Cloud / Supabase)

All tables in `public`, RLS on, `GRANT`s for `authenticated` + `service_role`. `has_role()` security-definer function for RBAC.

- `app_role` enum: `admin`, `staff`, `front_desk`
- `user_roles(user_id, role)` — separate table (never on profiles)
- `profiles(id → auth.users, full_name, avatar_url, phone)`
- `gym_settings` (singleton row: name, logo_url, address, brand color override, whatsapp default templates JSON, currency)
- `plans(id, name, duration_months, price, active)`
- `members(id, legacy_id, full_name, phone, phone_normalized, email, address, dob, emergency_contact, photo_url, plan_id, plan_type, total_fee, amount_paid, balance_due, start_date, expiry_date, frozen_at, trainer_id, notes, created_at, updated_at)` — `phone_normalized` indexed; unique index on `(phone_normalized, full_name)` NOT enforced (dupes allowed, flagged in UI).
- `staff(id, user_id nullable, full_name, phone, email, role_label, shift_start, shift_end, active)`
- `invoices(id, member_id, number, issued_at, subtotal, total, status, pdf_url)`
- `invoice_items(id, invoice_id, description, qty, unit_price, amount)`
- `payments(id, member_id, invoice_id nullable, amount, mode, paid_at, note)`
- `attendance(id, subject_type[member|staff], subject_id, check_in, check_out)`
- `pt_packages(id, name, sessions, price, validity_days)`
- `pt_enrollments(id, member_id, package_id, trainer_id, sessions_remaining, expires_at)`
- `pt_sessions(id, enrollment_id, trainer_id, scheduled_at, completed_at, notes)`
- `progress_notes(id, member_id, recorded_at, weight, measurements jsonb, goals)`
- `messages_log(id, member_id, channel[whatsapp], template_key, body, sent_by, sent_at)`
- `legacy_activity_log(id, member_id nullable, member_name, action, plan_type, occurred_at)` — unlinked rows visible in "unmatched history"

**Membership status** computed in a SQL view `members_with_status` (active / expiring_soon / expired / frozen) based on `expiry_date` and `frozen_at`.

**Storage buckets**: `member-photos` (public), `gym-branding` (public), `invoices` (private).

**RLS**: any authenticated user in `user_roles` can read; writes gated by role (admin all, staff most, front_desk limited to check-ins/payments/members). Single-tenant per project (no gym_id partitioning) — spec says "gym data stays isolated" which RLS-by-auth handles.

## Routes (TanStack Start)

- `/auth` — login (Fitness Dream branded, orange gradient card)
- `/_authenticated/route.tsx` — integration-managed gate
- `/_authenticated/index.tsx` → redirect to `/dashboard`
- `/_authenticated/dashboard` — metrics + charts + quick actions
- `/_authenticated/members` (list, filter, search) + `/members/$id` (profile tabs: overview, payments, attendance, PT, messages, notes) + `/members/new`
- `/_authenticated/staff`, `/staff/$id`
- `/_authenticated/billing` (invoices list) + `/billing/new` + `/billing/$id` (PDF preview)
- `/_authenticated/attendance` (today + analytics) + QR check-in scanner page
- `/_authenticated/pt` (packages, calendar, sessions)
- `/_authenticated/settings/gym`, `/settings/plans`, `/settings/templates`, `/settings/backup`, `/settings/users`
- `src/routes/index.tsx` — public landing/redirect to /auth (replaces placeholder)

## Modules

1. **Auth & Roles** — Supabase email/password sign-in; first user auto-promoted to admin via trigger; Settings › Users lets admin assign roles.
2. **Members** — full CRUD; photo upload; QR code shown on profile (encodes member id); scanner route uses `html5-qrcode` to mark attendance.
3. **Staff** — CRUD, trainer assignment select on member form, staff check-in.
4. **Billing** — invoice builder (line items), auto-invoice on member create/renew, payments (partial supported → recompute `balance_due`), PDF via `jspdf` + `jspdf-autotable` with logo. Revenue dashboard uses aggregated queries.
5. **WhatsApp (deep link only)** — every relevant place (invoice, reminder, member profile) has a "Send via WhatsApp" button that opens `https://wa.me/<phone_normalized_with_country>?text=<encoded template>`. Clicking logs a row in `messages_log`. Templates editable in Settings.
6. **PT** — packages CRUD, enroll member, calendar view (`react-day-picker` + list), mark session complete, progress notes timeline.
7. **Attendance** — check-in/out, daily log, peak-hour histogram, monthly footfall line chart (recharts).
8. **Dashboard** — 6 KPI cards (active, expiring 7d, revenue MTD, new joins MTD, attendance today, outstanding balance), revenue trend chart, expiring-soon list, quick actions.
9. **Backup & Restore** — described in detail below.
10. **Settings** — gym profile + logo upload, plans CRUD, WhatsApp templates (default text + variable tokens like `{{name}}`, `{{expiry}}`, `{{amount}}`), users/roles, backup section.

## Backup & Restore (module 9) — detailed

**Backup**: server function aggregates all tables → JSON matching the spec shape (`timestamp`, `counts`, `members`, `staff`, `attendance`, `activity_log`), download as `fitness-dream-backup-YYYYMMDD.json`.

**Restore** (`/settings/backup`):

1. Upload JSON file (client-side parse).
2. Normalize each member's phone: strip spaces, strip leading `+91`, keep last 10 digits → `phone_normalized`.
3. Match candidates against existing members using **`phone_normalized` + `full_name`** (case-insensitive, trimmed).
4. Detect *possible duplicates/renewals*: within the import file, group by `(phone_normalized, full_name)`; groups with >1 row and differing `start_date`/`expiry_date` → flagged, not auto-merged.
5. **Preview screen** shows: total members found, flagged possible duplicates (side-by-side rows), unmatched activity_log count, rows missing required fields (`full_name` or `phone`). Admin selects action per flagged group: *merge into one*, *keep both*, or *skip*.
6. On confirm: bulk insert members (with `legacy_id` = old uuid, missing fields blank). For each imported member with `amount_paid` or `balance_due`, insert one seed `payments` row (amount = `amount_paid`, mode = `unknown`, `paid_at` = `start_date`) and one `invoices` row (`total` = `total_fee`, `status` derived from balance).
7. Map `activity_log` → `legacy_activity_log`: match by `member_name` + `created_at` (closest same-day) → `member_id`; else insert with `member_id = null`.
8. **Results summary**: imported / skipped / flagged counts, "Download CSV of flagged rows" button. Unmatched activity visible at `/settings/backup/unmatched`.

Restore runs in a single `createServerFn` with `requireSupabaseAuth` + admin role check; uses `supabaseAdmin` inside the handler for bulk inserts.

## Technical

- TanStack Query for all reads (loader `ensureQueryData` + `useSuspenseQuery`); optimistic mutations for check-ins, payments, member edits.
- Zod validation on every form (`react-hook-form` + `@hookform/resolvers/zod`).
- Skeletons on all lists; empty states with icon + CTA.
- Recharts for charts, `date-fns` for date math, `jspdf`/`jspdf-autotable` for invoices, `html5-qrcode` for scanning, `qrcode.react` for rendering.
- Theme toggle: `next-themes`-style hook writing `.dark` class + localStorage; SSR-safe (read in `useEffect`).
- Head metadata per route (unique title/description/og).

## Build sequence (single turn, but ordered internally)

1. Enable Lovable Cloud.
2. Migration: enums, tables, `has_role`, RLS policies, GRANTs, `members_with_status` view, storage buckets, first-user-admin trigger.
3. Design tokens (styles.css), fonts, theme toggle, app shell (sidebar + topbar), auth route + gated layout.
4. Members module (list, detail, form, photo upload, QR).
5. Staff, plans, settings scaffolding.
6. Billing (invoices, payments, PDF, revenue).
7. Backup & Restore (backup export + full restore flow with preview + results).
8. Attendance (check-in UI + scanner + analytics).
9. PT (packages, enrollments, calendar, sessions, progress).
10. WhatsApp deep-link buttons + templates + message log everywhere relevant.
11. Dashboard (KPIs + charts + quick actions).
12. Polish: animations, empty states, skeletons, mobile pass, per-route SEO heads.

## Out of scope / assumptions

- Single-tenant per Lovable project (one gym per deployment). Multi-gym partitioning not built.
- No real WhatsApp API — deep link only (per your answer). Provider can be swapped in later behind the same button.
- PDF invoices generated client-side; stored to `invoices` bucket on demand.
- No i18n; USD default currency, editable in gym settings.
- No SMS/email; only WhatsApp deep link.
