
-- ============ Soft-delete columns ============
ALTER TABLE public.members         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.members         ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.members         ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.leads           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leads           ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.leads           ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.invoices        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.invoices        ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.invoices        ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.payments        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.payments        ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.payments        ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.pt_enrollments  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.pt_enrollments  ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.pt_enrollments  ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.pt_sessions     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.pt_sessions     ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.pt_sessions     ADD COLUMN IF NOT EXISTS deleted_reason text;

ALTER TABLE public.staff           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.staff           ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.staff           ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS idx_members_deleted_at  ON public.members  (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at    ON public.leads    (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_enr_deleted_at   ON public.pt_enrollments (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_sess_deleted_at  ON public.pt_sessions (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_deleted_at    ON public.staff    (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============ Audit log (immutable) ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     uuid,
  actor_name   text,
  action       text NOT NULL,           -- e.g. 'soft_delete','restore','purge','void_invoice','edit_payment','reassign_pt','undo_renewal','renewal','payment_recorded'
  entity_type  text NOT NULL,           -- 'member','lead','invoice','payment','pt_enrollment','pt_session','staff'
  entity_id    uuid,
  member_id    uuid,                    -- optional link for member timelines
  summary      text NOT NULL,
  metadata     jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Any signed-in staff/admin can read
DROP POLICY IF EXISTS "audit_log read" ON public.audit_log;
CREATE POLICY "audit_log read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (private.current_user_has_any_role());

-- Only signed-in staff/admin can insert; and only rows attributed to themselves
DROP POLICY IF EXISTS "audit_log insert self" ON public.audit_log;
CREATE POLICY "audit_log insert self" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (private.current_user_has_any_role() AND actor_id = auth.uid());

-- DB-enforced immutability: no UPDATE / DELETE policies at all.
-- (No policy = denied under RLS. Service role still bypasses RLS for maintenance.)

CREATE INDEX IF NOT EXISTS idx_audit_member  ON public.audit_log (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log (created_at DESC);

-- ============ 30-day purge RPC (admin only) ============
CREATE OR REPLACE FUNCTION public.purge_expired_soft_deletes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '30 days';
  r_members int; r_leads int; r_invoices int; r_payments int;
  r_pt_enr int; r_pt_sess int; r_staff int;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can purge deleted records';
  END IF;

  WITH d AS (DELETE FROM public.pt_sessions    WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_pt_sess FROM d;
  WITH d AS (DELETE FROM public.pt_enrollments WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_pt_enr  FROM d;
  WITH d AS (DELETE FROM public.payments       WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_payments FROM d;
  WITH d AS (DELETE FROM public.invoices       WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_invoices FROM d;
  WITH d AS (DELETE FROM public.leads          WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_leads    FROM d;
  WITH d AS (DELETE FROM public.staff          WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_staff    FROM d;
  WITH d AS (DELETE FROM public.members        WHERE deleted_at IS NOT NULL AND deleted_at < cutoff RETURNING 1) SELECT count(*) INTO r_members  FROM d;

  RETURN jsonb_build_object(
    'members', r_members, 'leads', r_leads, 'invoices', r_invoices,
    'payments', r_payments, 'pt_enrollments', r_pt_enr,
    'pt_sessions', r_pt_sess, 'staff', r_staff,
    'cutoff', cutoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_soft_deletes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_soft_deletes() TO authenticated;
