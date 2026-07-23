
CREATE POLICY "storage authed read gym files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('member-photos','gym-branding') AND public.current_user_has_any_role());
CREATE POLICY "storage authed write gym files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('member-photos','gym-branding') AND public.current_user_has_any_role());
CREATE POLICY "storage authed update gym files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('member-photos','gym-branding') AND public.current_user_has_any_role())
WITH CHECK (bucket_id IN ('member-photos','gym-branding') AND public.current_user_has_any_role());
CREATE POLICY "storage admin delete gym files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('member-photos','gym-branding') AND public.has_role(auth.uid(),'admin'));
