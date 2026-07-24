
CREATE OR REPLACE FUNCTION public.purge_expired_soft_deletes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
