import { useEffect, useState } from "react";

/** Live prefers-reduced-motion. Drives instant (non-animated) rendering. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Ease a number from 0 to `target` over `durationMs` when `play` is true;
 * otherwise (or under reduced motion) return the target immediately.
 */
export function useCountUp(target: number, play: boolean, durationMs = 380): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(play && !reduced ? 0 : target);

  useEffect(() => {
    if (!play || reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, play, reduced, durationMs]);

  return value;
}
