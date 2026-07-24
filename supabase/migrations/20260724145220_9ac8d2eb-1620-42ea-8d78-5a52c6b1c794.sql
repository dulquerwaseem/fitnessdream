
-- Duplicate-invoice guard: raises exception if an identical invoice was just inserted
CREATE OR REPLACE FUNCTION public.prevent_duplicate_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE member_id = NEW.member_id
        AND total = NEW.total
        AND COALESCE(notes,'') = COALESCE(NEW.notes,'')
        AND deleted_at IS NULL
        AND id <> NEW.id
        AND created_at > now() - interval '5 seconds'
    ) THEN
      RAISE EXCEPTION 'Duplicate invoice blocked: an identical invoice was just created for this member. Please refresh and check before retrying.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_invoice ON public.invoices;
CREATE TRIGGER trg_prevent_duplicate_invoice
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_invoice();

-- Void 3 confirmed duplicate PT invoices (keep INV-1000, void INV-1001/1002/1003)
UPDATE public.invoices
SET deleted_at = now(),
    deleted_reason = 'Auto-voided: duplicate created by double-submit bug (kept INV-1000)'
WHERE id IN (
  '2aa395a3-29fe-4937-b546-fdbbc3f8f2dd',
  '21b98cdd-b761-4025-86aa-44991e4ffb6e',
  '16c4da31-d7ce-4f7d-904a-37c64f2859f8'
);
