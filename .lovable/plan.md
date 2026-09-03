# Selectable GST rate (5% or 18%)

Today the GST rate is a free-text field in Settings, and the New Invoice screen ignores it entirely — it always splits at 18%. This change makes the rate a clear choice between 5% and 18%, and makes every screen honour it.

## What changes

1. **Settings → Gym profile**: the "GST rate %" text box becomes a dropdown with two options — 5% (inclusive) and 18% (inclusive). Saving stores the chosen rate.
2. **New invoice**: the tax breakdown uses the saved gym GST rate instead of the hardcoded 18%, and the label reads "GST @ 5% (included)" or "GST @ 18% (included)" accordingly.
3. **Invoice detail + invoice PDF**: already read the saved rate, so they follow automatically once the setting is a clean 5 or 18.

Amounts stay GST-inclusive exactly as now — only the split ratio changes.

## Technical notes

- `src/routes/_authenticated/settings.tsx`: replace the `gst_rate` `Input` with a shadcn `Select` (values "5" and "18"); keep the existing save path (`Number(gymForm.gst_rate || 18)`).
- `src/routes/_authenticated/billing.new.tsx`: fetch `gym_settings` (cached query, same key `["gym-settings"]` used elsewhere) and call `gstSplit(subtotal, Number(gym?.gst_rate ?? 18))`.
- No database or schema change: `gym_settings.gst_rate` is already a numeric column.
