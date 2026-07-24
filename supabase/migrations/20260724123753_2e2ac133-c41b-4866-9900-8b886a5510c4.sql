
ALTER TABLE public.gym_settings
  ADD COLUMN IF NOT EXISTS invoice_terms text NOT NULL DEFAULT
'• Membership fees once paid are non-refundable.
• Membership is non-transferable to another person.
• PT session packages must be used within their validity period; unused sessions do not carry forward or get refunded after expiry.
• Late renewal after expiry may result in loss of access until renewed.
• The gym is not responsible for loss of personal belongings.
• For billing queries, please contact Fitness Dream within 7 days of the invoice date.';

UPDATE public.gym_settings
SET invoice_terms =
'• Membership fees once paid are non-refundable.
• Membership is non-transferable to another person.
• PT session packages must be used within their validity period; unused sessions do not carry forward or get refunded after expiry.
• Late renewal after expiry may result in loss of access until renewed.
• The gym is not responsible for loss of personal belongings.
• For billing queries, please contact Fitness Dream within 7 days of the invoice date.'
WHERE invoice_terms IS NULL OR btrim(invoice_terms) = '';
