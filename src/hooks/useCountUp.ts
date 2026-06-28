import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  target: number;
  duration?: number;
  decimals?: number;
  enabled?: boolean;
}

/**
 * Animates a number from 0 → target using ease-out cubic curve.
 * Only starts when `enabled` flips to true (e.g. after IntersectionObserver fires).
 */
export function useCountUp({
  target,
  duration = 1800,
  decimals = 0,
  enabled = true,
}: UseCountUpOptions): number {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    startRef.current = null;
    setCount(0);

    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = parseFloat((eased * target).toFixed(decimals));
      setCount(value);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, decimals, enabled]);

  return count;
}
