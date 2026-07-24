
CREATE INDEX IF NOT EXISTS idx_invoices_member ON public.invoices (member_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices (issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON public.members (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_start_date ON public.members (start_date);
CREATE INDEX IF NOT EXISTS idx_members_frozen_at ON public.members (frozen_at);
CREATE INDEX IF NOT EXISTS idx_messages_log_member ON public.messages_log (member_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_enrollments_member ON public.pt_enrollments (member_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_enrollment ON public.pt_sessions (enrollment_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_notes_member ON public.progress_notes (member_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
