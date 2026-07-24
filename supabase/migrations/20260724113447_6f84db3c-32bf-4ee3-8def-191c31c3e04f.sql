CREATE POLICY "auth upload invoices" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices');
CREATE POLICY "auth read invoices" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices');
CREATE POLICY "auth update invoices" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invoices');