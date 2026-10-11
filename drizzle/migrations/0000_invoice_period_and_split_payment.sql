ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS paid_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_upi numeric NOT NULL DEFAULT 0;
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS bonus_months integer NOT NULL DEFAULT 0;