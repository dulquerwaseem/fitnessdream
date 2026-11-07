-- Staff biometric access + attendance, mirroring the member biometric setup
-- (001_biometric_setup.sql / 20261101020300_...sql) but for the staff table.

-- 1. Staff biometric fields.
alter table public.staff
  add column if not exists biometric_uid integer unique check (biometric_uid between 1 and 3000),
  add column if not exists biometric_active boolean not null default false;

-- 2. biometric_device_enrollment currently only supports members (member_id
-- not null, composite PK (member_id, device_ip)). Extend it to also carry
-- staff rows: add a nullable staff_id, relax member_id to nullable, and
-- replace the composite PK with a surrogate id + partial unique indexes so
-- exactly one of member_id/staff_id is set per row.
alter table public.biometric_device_enrollment
  add column if not exists staff_id uuid references public.staff(id) on delete cascade;

alter table public.biometric_device_enrollment
  drop constraint if exists biometric_device_enrollment_pkey;

alter table public.biometric_device_enrollment
  alter column member_id drop not null;

alter table public.biometric_device_enrollment
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.biometric_device_enrollment
  add constraint biometric_device_enrollment_pkey primary key (id);

alter table public.biometric_device_enrollment
  add constraint biometric_device_enrollment_one_owner check (
    (member_id is not null and staff_id is null) or
    (member_id is null and staff_id is not null)
  );

create unique index if not exists biometric_device_enrollment_member_device_idx
  on public.biometric_device_enrollment (member_id, device_ip) where member_id is not null;

create unique index if not exists biometric_device_enrollment_staff_device_idx
  on public.biometric_device_enrollment (staff_id, device_ip) where staff_id is not null;

create policy "staff can enroll staff on devices"
  on public.biometric_device_enrollment
  for insert to authenticated
  with check (
    staff_id is not null and exists (
      select 1 from public.user_roles where user_roles.user_id = auth.uid()
    )
  );

-- 3. Staff attendance (check-in / check-out), separate from the raw
-- member punch log (biometric_attendance) since staff attendance is
-- tracked as shifts rather than individual punches.
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  check_in timestamptz not null,
  check_out timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_attendance_staff_id_idx
  on public.staff_attendance (staff_id);
create index if not exists staff_attendance_check_in_idx
  on public.staff_attendance (check_in desc);

alter table public.staff_attendance enable row level security;

create policy "staff can read staff attendance"
  on public.staff_attendance
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles where user_roles.user_id = auth.uid()
    )
  );
