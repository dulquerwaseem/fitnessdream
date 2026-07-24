import { useEffect, useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (v: number) => void;
};

/**
 * Numeric input that:
 *  - starts empty when value is 0 (shows placeholder instead of "0")
 *  - lets the user fully erase the value while typing
 *  - never mutates on scroll wheel (blurs on wheel)
 *  - relies on global CSS to hide native spinner arrows
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, placeholder = "Enter amount", inputMode = "decimal", ...rest },
  ref,
) {
  const [text, setText] = useState<string>(value ? String(value) : "");

  useEffect(() => {
    const cur = text === "" ? 0 : Number(text);
    if (cur !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...rest}
      ref={ref}
      type="number"
      inputMode={inputMode}
      placeholder={placeholder}
      value={text}
      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        onChange(v === "" ? 0 : Number(v));
      }}
    />
  );
});
