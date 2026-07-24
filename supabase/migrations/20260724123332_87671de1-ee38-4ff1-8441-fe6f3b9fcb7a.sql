
-- 1) Private-schema helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.current_user_has_any_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_has_any_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_user_has_any_role() TO authenticated, service_role;

-- 2) Recreate public-table policies to use private.* helpers
DROP POLICY IF EXISTS "gym_settings admin write" ON public.gym_settings;
DROP POLICY IF EXISTS "gym_settings read" ON public.gym_settings;
CREATE POLICY "gym_settings admin write" ON public.gym_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "gym_settings read" ON public.gym_settings FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "invoice_items rw" ON public.invoice_items;
CREATE POLICY "invoice_items rw" ON public.invoice_items FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "invoices rw" ON public.invoices;
CREATE POLICY "invoices rw" ON public.invoices FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "Admins delete activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Staff can insert activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Staff can view activities" ON public.lead_activities;
CREATE POLICY "Admins delete activities" ON public.lead_activities FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff can insert activities" ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (private.current_user_has_any_role());
CREATE POLICY "Staff can view activities" ON public.lead_activities FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "Admins manage stages" ON public.lead_stages;
DROP POLICY IF EXISTS "Any signed-in can view stages" ON public.lead_stages;
CREATE POLICY "Admins manage stages" ON public.lead_stages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Any signed-in can view stages" ON public.lead_stages FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "Admins manage lead templates" ON public.lead_templates;
DROP POLICY IF EXISTS "Any signed-in can view lead templates" ON public.lead_templates;
CREATE POLICY "Admins manage lead templates" ON public.lead_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Any signed-in can view lead templates" ON public.lead_templates FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "Admins delete leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can update leads" ON public.leads;
DROP POLICY IF EXISTS "Staff can view leads" ON public.leads;
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff can insert leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (private.current_user_has_any_role());
CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());
CREATE POLICY "Staff can view leads" ON public.leads FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "legacy_activity_log rw" ON public.legacy_activity_log;
CREATE POLICY "legacy_activity_log rw" ON public.legacy_activity_log FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "members read" ON public.members;
DROP POLICY IF EXISTS "members write" ON public.members;
CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "messages_log rw" ON public.messages_log;
CREATE POLICY "messages_log rw" ON public.messages_log FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "payments rw" ON public.payments;
CREATE POLICY "payments rw" ON public.payments FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "plans admin write" ON public.plans;
DROP POLICY IF EXISTS "plans read" ON public.plans;
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "plans read" ON public.plans FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "progress_notes rw" ON public.progress_notes;
CREATE POLICY "progress_notes rw" ON public.progress_notes FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "pt_enrollments rw" ON public.pt_enrollments;
CREATE POLICY "pt_enrollments rw" ON public.pt_enrollments FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "pt_packages admin write" ON public.pt_packages;
DROP POLICY IF EXISTS "pt_packages read" ON public.pt_packages;
CREATE POLICY "pt_packages admin write" ON public.pt_packages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "pt_packages read" ON public.pt_packages FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "pt_sessions rw" ON public.pt_sessions;
CREATE POLICY "pt_sessions rw" ON public.pt_sessions FOR ALL TO authenticated
  USING (private.current_user_has_any_role()) WITH CHECK (private.current_user_has_any_role());

DROP POLICY IF EXISTS "staff admin write" ON public.staff;
DROP POLICY IF EXISTS "staff read" ON public.staff;
CREATE POLICY "staff admin write" ON public.staff FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "staff read" ON public.staff FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

DROP POLICY IF EXISTS "user_roles admin write" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles read self or admin" ON public.user_roles;
CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles read self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- 3) Profiles: self or admin only
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
CREATE POLICY "profiles read self or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.has_role(auth.uid(),'admin'));

-- 4) Storage: gym files policies (previously referenced public helpers)
DROP POLICY IF EXISTS "storage authed read gym files" ON storage.objects;
DROP POLICY IF EXISTS "storage authed write gym files" ON storage.objects;
DROP POLICY IF EXISTS "storage authed update gym files" ON storage.objects;
DROP POLICY IF EXISTS "storage admin delete gym files" ON storage.objects;
CREATE POLICY "storage authed read gym files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = ANY (ARRAY['member-photos','gym-branding']) AND private.current_user_has_any_role());
CREATE POLICY "storage authed write gym files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = ANY (ARRAY['member-photos','gym-branding']) AND private.current_user_has_any_role());
CREATE POLICY "storage authed update gym files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = ANY (ARRAY['member-photos','gym-branding']) AND private.current_user_has_any_role())
  WITH CHECK (bucket_id = ANY (ARRAY['member-photos','gym-branding']) AND private.current_user_has_any_role());
CREATE POLICY "storage admin delete gym files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = ANY (ARRAY['member-photos','gym-branding']) AND private.has_role(auth.uid(),'admin'));

-- 5) Storage: invoices bucket locked down to staff (role required, not just any authenticated)
DROP POLICY IF EXISTS "auth upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "auth read invoices" ON storage.objects;
DROP POLICY IF EXISTS "auth update invoices" ON storage.objects;
CREATE POLICY "staff read invoices" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND private.current_user_has_any_role());
CREATE POLICY "staff upload invoices" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND private.current_user_has_any_role());
CREATE POLICY "staff update invoices" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND private.current_user_has_any_role())
  WITH CHECK (bucket_id = 'invoices' AND private.current_user_has_any_role());
CREATE POLICY "staff delete invoices" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices' AND private.current_user_has_any_role());

-- 6) Drop old public helpers now that nothing references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.current_user_has_any_role();
