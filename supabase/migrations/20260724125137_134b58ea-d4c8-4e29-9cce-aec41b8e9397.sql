DROP VIEW IF EXISTS public.members_with_status;
CREATE VIEW public.members_with_status AS
SELECT id, legacy_id, full_name, phone, phone_normalized, email, address, dob,
       emergency_contact, photo_url, plan_id, plan_type, total_fee, amount_paid,
       balance_due, start_date, expiry_date, frozen_at, trainer_id, notes,
       created_at, updated_at, deleted_at,
       CASE
         WHEN frozen_at IS NOT NULL THEN 'frozen'::member_status
         WHEN expiry_date < CURRENT_DATE THEN 'expired'::member_status
         WHEN expiry_date <= (CURRENT_DATE + '7 days'::interval) THEN 'expiring_soon'::member_status
         ELSE 'active'::member_status
       END AS status,
       expiry_date - CURRENT_DATE AS days_until_expiry
FROM members m
WHERE deleted_at IS NULL;
GRANT SELECT ON public.members_with_status TO authenticated;
GRANT SELECT ON public.members_with_status TO service_role;