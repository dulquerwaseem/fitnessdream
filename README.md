# Fitness Dream Hub (22)

Build a modern, extremely fast, visually polished Gym Management SaaS web app called 

"Fitness Dream". Use Supabase as the backend (Auth + Database + Storage + Edge Functions). 

Design should feel premium — dark/light mode toggle, smooth animations, card-based 

dashboards, clean typography, bold and energetic fitness branding (strong accent color, 

confident headings), fully mobile responsive. Think Linear/Notion-level polish, not a 

generic admin template.

CORE MODULES:

1. Authentication & Roles

   - Roles: Owner/Admin, Staff/Trainer, Front Desk

   - Role-based access control on all pages

   - Login screen with Fitness Dream branding/logo

2. Member Management

   - Fields: full name, phone, email, address, DOB, emergency contact, photo

   - Membership plan (plan_type), amount_paid, total_fee, balance_due, start_date, 

     expiry_date, frozen_at (for freeze/pause)

   - Membership status computed as: active, expiring soon (within 7 days), expired, frozen

   - Search, filter, sort members (by plan, status, join date, balance due)

   - Member profile page showing full history: payments, attendance, PT sessions, activity log

   - QR code / barcode check-in for attendance

3. Staff Management

   - Staff profiles, roles, shift timings, contact info

   - Attendance/check-in tracking for staff

   - Assign trainers to members

4. Billing & Invoicing

   - Auto-generate invoice on membership purchase/renewal

   - Manual invoice creation for add-ons (PT sessions, supplements, etc.)

   - Track total_fee, amount_paid, balance_due per member; support partial payments

   - Multiple payment modes (cash, card, UPI, bank transfer)

   - Downloadable/printable PDF invoices with Fitness Dream branding

   - Revenue dashboard: daily/monthly/yearly income, outstanding dues

5. WhatsApp Integration (via WhatsApp Cloud API / Twilio, through a Supabase Edge Function)

   - Send invoice as PDF/link via WhatsApp on generation

   - Automated renewal reminders (7 days, 3 days, 1 day before expiry_date)

   - Automated payment due reminders for members with balance_due > 0

   - Manual "send message" button from member profile

   - Message log/history per member

   - Editable message templates in Settings

6. Personal Training

   - PT package management (sessions count, price, validity)

   - Session scheduling/calendar per trainer

   - Session completion tracking

   - Client progress notes (weight, measurements, goals)

7. Attendance

   - Daily check-in/check-out log per member and staff

   - Attendance analytics (peak hours, monthly footfall)

8. Dashboard (Home Screen)

   - Key metrics: active members, expiring this week, revenue this month, new joins, 

     attendance today, total outstanding balance

   - Charts/graphs for trends

   - Quick actions: add member, create invoice, send reminder

9. Data Backup & Restore (Settings) — BUILD THIS EXACTLY AS SPECIFIED BELOW

   "Backup Data" button: exports all current data as JSON in the same structure 

   described below, so backups from THIS app can also be restored later.

   "Restore from Backup" feature: accepts a JSON file upload matching this EXACT 

   structure (this is real data from a previous system, use this as the authoritative 

   schema to build the parser against):

   {

     "timestamp": "ISO date string",

     "counts": { "members": number, "staff": number, "attendance": number, "activity_log": number },

     "members": [

       {

         "id": "uuid (old system's id, do not reuse as primary key — store as legacy_id)",

         "full_name": "string",

         "phone": "string — format INCONSISTENT: mix of plain 10-digit numbers and 

                    '+91 XXXXX XXXXX' with spaces",

         "plan_type": "string, e.g. '1 Month', '3 Months', '6 Months', '12 Months'",

         "amount_paid": number,

         "start_date": "YYYY-MM-DD",

         "expiry_date": "YYYY-MM-DD",

         "created_at": "ISO timestamp",

         "updated_at": "ISO timestamp",

         "total_fee": number,

         "balance_due": number,

         "frozen_at": "ISO timestamp or null"

       }

     ],

     "staff": [ /* staff records, similar shape — map fields as found */ ],

     "attendance": [ /* attendance records — map fields as found */ ],

     "activity_log": [

       {

         "id": "uuid",

         "member_name": "string (name only, not a foreign key)",

         "action": "one of: joined, renewed, payment_updated, deleted",

         "plan_type": "string",

         "created_at": "ISO timestamp"

       }

     ]

   }

   IMPORT LOGIC — implement all of these, this data has known quality issues:

   - Normalize every phone number before matching: strip spaces, strip '+91' prefix, 

     keep only the last 10 digits

   - Detect duplicates using normalized phone + full_name together, NOT phone alone 

     (this dataset has the same phone number reused across different member names — 

     those are different people and must NOT be merged)

   - Where the same phone + same name appears more than once with different 

     start_date/expiry_date (renewal recorded as a duplicate signup), flag as 

     "possible duplicate/renewal" and show both records to the admin to manually 

     merge or keep separate — do not auto-merge

   - For each imported member, auto-create one initial payment record in the 

     payments table using amount_paid (paid amount) and total_fee/balance_due 

     (to reconstruct payment status)

   - Map activity_log entries into the app's own history/message log table, matching 

     by member_name + created_at to the correct imported member where possible; if no 

     match is found, keep the log entry unlinked but visible in an "unmatched history" view

   - Fields with no equivalent in the old data (email, address, DOB, emergency contact, 

     photo) should simply be left blank — never block the import for missing fields

   - Before committing anything, show a preview screen: total members found, count of 

     flagged possible duplicates, count of unmatched activity_log entries, and any 

     rows with missing required fields (full_name or phone)

   - After import, show a results summary: number imported successfully, number 

     skipped, number flagged for manual review, with a downloadable CSV of anything 

     flagged

10. Settings

   - Gym profile, branding, logo upload for Fitness Dream

   - Membership plan configuration

   - WhatsApp API credentials configuration

   - Notification templates (editable message text)

   - Backup & Restore section (module 9)

TECHNICAL REQUIREMENTS:

- Fast load times, optimistic UI updates, skeleton loaders (no blank/slow screens)

- Fully responsive (tablet at front desk, phone for trainers)

- Data validation on all forms

- Proper Supabase Row Level Security so gym data stays isolated

- Clean component structure so features can be extended later

BUILD ORDER (confirm each stage works before moving to the next):

1. Database schema (members, staff, plans, invoices, payments, attendance, 

   pt_sessions, messages_log, legacy_activity_log tables) + Auth + role setup

2. Dashboard + Member Management module

3. Billing & Invoicing module

4. Backup & Restore module (module 9) — test this with a real JSON upload before 

   moving on, since it's the most complex piece

5. Attendance + Personal Training modules

6. WhatsApp integration (Edge Functions)

7. Final polish — animations, empty states, loading states, mobile responsiveness

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fitnessdream.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8a95128b-047d-431c-8e84-395ec39370a3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
