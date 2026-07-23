
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'front_desk');
CREATE TYPE public.member_status AS ENUM ('active', 'expiring_soon', 'expired', 'frozen');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'card', 'upi', 'bank_transfer', 'unknown');
CREATE TYPE public.invoice_status AS ENUM ('paid', 'partial', 'unpaid');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

CREATE POLICY "user_roles read self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Handle new user: create profile + auto-admin the first user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Helper: any authenticated staff member ============
-- Used by policies below so any user with any role can read/write core gym data.

-- ============ GYM SETTINGS (singleton) ============
CREATE TABLE public.gym_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Fitness Dream',
  tagline TEXT DEFAULT 'Push harder. Live stronger.',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  whatsapp_country_code TEXT NOT NULL DEFAULT '91',
  templates JSONB NOT NULL DEFAULT '{
    "invoice": "Hi {{name}}, your invoice #{{invoice_number}} for {{currency}}{{amount}} at Fitness Dream is ready. Thank you!",
    "renewal_7": "Hi {{name}}, your Fitness Dream membership expires in 7 days on {{expiry}}. Renew today and keep the streak going!",
    "renewal_3": "Hi {{name}}, only 3 days left on your Fitness Dream membership (expires {{expiry}}). Renew now.",
    "renewal_1": "Hi {{name}}, your Fitness Dream membership expires tomorrow ({{expiry}}). Renew today to avoid a break in access.",
    "payment_due": "Hi {{name}}, a friendly reminder that {{currency}}{{balance}} is pending on your Fitness Dream account. Please clear it at your convenience.",
    "welcome": "Welcome to Fitness Dream, {{name}}! Your {{plan}} membership is active until {{expiry}}. See you at the gym!"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.gym_settings (id) VALUES (1);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_settings TO authenticated;
GRANT ALL ON public.gym_settings TO service_role;
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gym_settings read" ON public.gym_settings FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "gym_settings admin write" ON public.gym_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER gym_settings_updated BEFORE UPDATE ON public.gym_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PLANS ============
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_months INT NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read" ON public.plans FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.plans (name, duration_months, price) VALUES
  ('1 Month', 1, 1500),
  ('3 Months', 3, 4000),
  ('6 Months', 6, 7500),
  ('12 Months', 12, 13000);

-- ============ STAFF ============
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role_label TEXT NOT NULL DEFAULT 'Trainer',
  shift_start TIME,
  shift_end TIME,
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.staff FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "staff admin write" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MEMBERS ============
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id UUID,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  email TEXT,
  address TEXT,
  dob DATE,
  emergency_contact TEXT,
  photo_url TEXT,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_type TEXT,
  total_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  frozen_at TIMESTAMPTZ,
  trainer_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_phone_norm_idx ON public.members (phone_normalized);
CREATE INDEX members_expiry_idx ON public.members (expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());
CREATE TRIGGER members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- View computing membership status
CREATE OR REPLACE VIEW public.members_with_status
WITH (security_invoker = true) AS
SELECT m.*,
  CASE
    WHEN m.frozen_at IS NOT NULL THEN 'frozen'::member_status
    WHEN m.expiry_date < CURRENT_DATE THEN 'expired'::member_status
    WHEN m.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'expiring_soon'::member_status
    ELSE 'active'::member_status
  END AS status,
  (m.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM public.members m;
GRANT SELECT ON public.members_with_status TO authenticated;

-- ============ INVOICES / ITEMS / PAYMENTS ============
CREATE SEQUENCE public.invoice_number_seq START 1000;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || nextval('public.invoice_number_seq')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices rw" ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items rw" ON public.invoice_items FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  mode payment_mode NOT NULL DEFAULT 'cash',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_member_idx ON public.payments (member_id);
CREATE INDEX payments_paid_at_idx ON public.payments (paid_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments rw" ON public.payments FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member','staff')),
  subject_id UUID NOT NULL,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attendance_subject_idx ON public.attendance (subject_type, subject_id);
CREATE INDEX attendance_check_in_idx ON public.attendance (check_in);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance rw" ON public.attendance FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

-- ============ PERSONAL TRAINING ============
CREATE TABLE public.pt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sessions INT NOT NULL DEFAULT 10,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  validity_days INT NOT NULL DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_packages TO authenticated;
GRANT ALL ON public.pt_packages TO service_role;
ALTER TABLE public.pt_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_packages read" ON public.pt_packages FOR SELECT TO authenticated USING (public.current_user_has_any_role());
CREATE POLICY "pt_packages admin write" ON public.pt_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.pt_packages (name, sessions, price, validity_days) VALUES
  ('Starter (10 sessions)', 10, 5000, 60),
  ('Serious (20 sessions)', 20, 9000, 90),
  ('Elite (40 sessions)', 40, 16000, 180);

CREATE TABLE public.pt_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.pt_packages(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  sessions_total INT NOT NULL DEFAULT 0,
  sessions_used INT NOT NULL DEFAULT 0,
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_enrollments TO authenticated;
GRANT ALL ON public.pt_enrollments TO service_role;
ALTER TABLE public.pt_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_enrollments rw" ON public.pt_enrollments FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

CREATE TABLE public.pt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.pt_enrollments(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_sessions TO authenticated;
GRANT ALL ON public.pt_sessions TO service_role;
ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pt_sessions rw" ON public.pt_sessions FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

CREATE TABLE public.progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight NUMERIC(6,2),
  measurements JSONB DEFAULT '{}'::jsonb,
  goals TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_notes TO authenticated;
GRANT ALL ON public.progress_notes TO service_role;
ALTER TABLE public.progress_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_notes rw" ON public.progress_notes FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

-- ============ MESSAGES LOG ============
CREATE TABLE public.messages_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  template_key TEXT,
  body TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages_log TO authenticated;
GRANT ALL ON public.messages_log TO service_role;
ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_log rw" ON public.messages_log FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());

-- ============ LEGACY ACTIVITY LOG ============
CREATE TABLE public.legacy_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  action TEXT NOT NULL,
  plan_type TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX legacy_activity_member_idx ON public.legacy_activity_log (member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_activity_log TO authenticated;
GRANT ALL ON public.legacy_activity_log TO service_role;
ALTER TABLE public.legacy_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legacy_activity_log rw" ON public.legacy_activity_log FOR ALL TO authenticated
  USING (public.current_user_has_any_role()) WITH CHECK (public.current_user_has_any_role());
