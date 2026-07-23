
-- Lead source enum
DO $$ BEGIN
  CREATE TYPE public.lead_source AS ENUM ('walk_in','referral','instagram','google','whatsapp_inquiry','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stages (configurable)
CREATE TABLE public.lead_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  order_index INT NOT NULL DEFAULT 0,
  is_converted BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  follow_up_days INT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stages TO authenticated;
GRANT ALL ON public.lead_stages TO service_role;
ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any signed-in can view stages" ON public.lead_stages FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "Admins manage stages" ON public.lead_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_stages_updated BEFORE UPDATE ON public.lead_stages FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Templates
CREATE TABLE public.lead_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_templates TO authenticated;
GRANT ALL ON public.lead_templates TO service_role;
ALTER TABLE public.lead_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any signed-in can view lead templates" ON public.lead_templates FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "Admins manage lead templates" ON public.lead_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lead_templates_updated BEFORE UPDATE ON public.lead_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT,
  email TEXT,
  source public.lead_source NOT NULL DEFAULT 'walk_in',
  interested_plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  interested_plan_name TEXT,
  notes TEXT,
  stage_id UUID REFERENCES public.lead_stages(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  converted_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_stage ON public.leads(stage_id);
CREATE INDEX idx_leads_phone_norm ON public.leads(phone_normalized);
CREATE INDEX idx_leads_follow_up ON public.leads(next_follow_up_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view leads" ON public.leads FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "Staff can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.current_user_has_any_role());
CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE TO authenticated USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Lead activities
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,  -- note | whatsapp | stage_change | call | system
  template_key TEXT,
  body TEXT,
  meta JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view activities" ON public.lead_activities FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "Staff can insert activities" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (public.current_user_has_any_role());
CREATE POLICY "Admins delete activities" ON public.lead_activities FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Seed default stages
INSERT INTO public.lead_stages (name, order_index, is_converted, is_lost, follow_up_days, color) VALUES
 ('New', 1, false, false, 2, 'orange'),
 ('Contacted', 2, false, false, 3, 'blue'),
 ('Visited/Trial', 3, false, false, 5, 'violet'),
 ('Negotiating', 4, false, false, 3, 'amber'),
 ('Converted', 5, true, false, NULL, 'green'),
 ('Lost', 6, false, true, NULL, 'slate');

-- Seed default templates
INSERT INTO public.lead_templates (key, name, body) VALUES
 ('first_contact','First contact','Hi {{name}}! Thanks for reaching out to Fitness Dream. Would you like to schedule a free trial session this week?'),
 ('trial_invite','Trial invite','Hey {{name}}, we''d love to have you in for a free trial at Fitness Dream. When works for you?'),
 ('post_visit','Post-visit follow-up','Hi {{name}}, great meeting you at Fitness Dream! Do you have any questions about the plans we discussed?'),
 ('re_engagement','Re-engagement','Hi {{name}}, we haven''t heard back — still interested in starting your fitness journey with us? Happy to answer any questions.'),
 ('special_offer','Special offer','Hi {{name}}! Limited-time offer at Fitness Dream — join this week and get {{offer}}. Reply to claim.');
