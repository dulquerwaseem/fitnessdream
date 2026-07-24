import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Wraps an async action so it can't be double-invoked.
 * - Returns `[run, busy]`.
 * - While `busy` is true, further calls to `run` are ignored.
 * - Any thrown error is toasted; the flag is always cleared.
 */
export function useAsyncAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (...args: Args) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await fn(...args);
      } catch (e: any) {
        toast.error(e?.message ?? "Something went wrong");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [fn],
  );

  return [run, busy] as const;
}
