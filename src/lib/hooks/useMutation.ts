"use client";
import { useState, useCallback, useRef } from "react";

export interface MutationResult<TArgs extends unknown[], TResult> {
  mutate: (...args: TArgs) => Promise<TResult>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Wraps an async function with loading/error state and in-flight dedup.
 * Prevents duplicate submits. Throws on error so callers can catch.
 */
export function useMutation<TArgs extends unknown[], TResult = unknown>(
  fn: (...args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      if (inFlight.current) throw new Error("Request already in progress");
      inFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An error occurred";
        setError(msg);
        throw err;
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => setError(null), []);

  return { mutate, loading, error, reset };
}
