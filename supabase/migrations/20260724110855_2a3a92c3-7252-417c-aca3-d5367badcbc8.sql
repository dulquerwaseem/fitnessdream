
-- 1. Add phone_inquiry to lead_source enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'lead_source' AND e.enumlabel = 'phone_inquiry'
  ) THEN
    ALTER TYPE public.lead_source ADD VALUE 'phone_inquiry' BEFORE 'referral';
  END IF;
END$$;

-- 2. Add source_categories to lead_templates: array of source keys, or ['all']
ALTER TABLE public.lead_templates
  ADD COLUMN IF NOT EXISTS source_categories text[] NOT NULL DEFAULT ARRAY['all']::text[];

-- 3. Seed starter templates (only if key not already present)
INSERT INTO public.lead_templates (key, name, body, source_categories) VALUES
  ('visit_followup', 'Post-visit follow-up (Walk-in)',
   'Hi {{name}}, great meeting you today at Fitness Dream! Let us know if you have any questions about the plans we discussed. Ready to get started?',
   ARRAY['walk_in']),
  ('phone_recap', 'Phone inquiry recap',
   'Hi {{name}}, thanks for calling Fitness Dream today! As discussed, here are our plan details. Want to drop in for a free trial session this week?',
   ARRAY['phone_inquiry']),
  ('referral_intro', 'Referral welcome',
   'Hi {{name}}, thanks for reaching out — great to hear you were referred to Fitness Dream! We''d love to have you visit for a free trial. When works for you?',
   ARRAY['referral']),
  ('online_intro', 'Online inquiry — invite to visit',
   'Hi {{name}}, thanks for connecting with Fitness Dream! We''d love to show you around — visit any day this week for a free trial session. Reply to book a time.',
   ARRAY['instagram','google','whatsapp_inquiry']),
  ('reengagement_offer', 'Re-engagement — limited-time offer',
   'Hi {{name}}, haven''t heard back — we''re running a limited-time offer this month at Fitness Dream. Interested in taking a look before it ends?',
   ARRAY['all'])
ON CONFLICT (key) DO NOTHING;
