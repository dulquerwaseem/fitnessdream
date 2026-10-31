-- Run this once in the Supabase SQL editor for the fitness-dream-membership project.
-- Adds the write policies the member profile's Biometric tab needs. The original
-- sql/001_biometric_setup.sql only granted staff SELECT on biometric_device_enrollment
-- (reads/writes from fitness-dream-bridge itself go through the service_role key, which
-- bypasses RLS entirely) — the web app runs as an authenticated staff user under the
-- publishable key, so it needs its own INSERT/UPDATE/DELETE policies here.

create policy "staff can enroll on devices"
  on public.biometric_device_enrollment
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
    )
  );

create policy "staff can update device enrollment"
  on public.biometric_device_enrollment
  for update to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
    )
  );

create policy "staff can remove device enrollment"
  on public.biometric_device_enrollment
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
    )
  );
