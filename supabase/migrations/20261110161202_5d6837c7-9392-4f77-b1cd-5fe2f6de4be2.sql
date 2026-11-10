-- The staff biometric enroll/remove/re-enable actions (staff-biometric-tab.tsx)
-- run as an authenticated staff user under the publishable key, not service_role.
-- "staff admin write" (20260724123332_...sql) restricts ALL writes on public.staff
-- to private.has_role(auth.uid(),'admin'), so any non-admin staff member hits a
-- silent 0-row UPDATE when trying to set biometric_uid/biometric_active.
--
-- Postgres RLS can't restrict a policy to specific columns, so this grants any
-- authenticated user with a role in user_roles UPDATE access to the staff row
-- (same EXISTS(user_roles) check used by the "staff can enroll on devices" /
-- "staff can update device enrollment" policies on biometric_device_enrollment).
-- Multiple permissive policies for the same command are OR'd together, so this
-- is additive to "staff admin write" rather than replacing it.
create policy "staff can update biometric fields"
  on public.staff
  for update to authenticated
  using (
    exists (select 1 from public.user_roles where user_roles.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.user_roles where user_roles.user_id = auth.uid())
  );
