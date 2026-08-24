ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS gst_rate numeric NOT NULL DEFAULT 18;
UPDATE public.gym_settings SET gst_number = COALESCE(NULLIF(gst_number, ''), '29FFXPA1172L2ZU');