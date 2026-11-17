import * as React from "react";
import { useEffect, useRef } from "react";

const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Animates a number from 0 to `to`, formatting each frame. A new animation
 *  cancels the previous one on the same element. Works as an SVG <text> too. */
export function CountUp({
  value,
  format,
  as = "span",
  className,
  ...rest
}: {
  value: number;
  format: (v: number) => string;
  as?: "span" | "b" | "div" | "text";
  className?: string;
} & Omit<React.SVGAttributes<SVGTextElement>, "format">) {
  const ref = useRef<HTMLElement | null>(null);
  const ticket = useRef(0);
  const fmtRef = useRef(format);
  fmtRef.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = ++ticket.current;
    if (calm() || document.hidden) {
      el.textContent = fmtRef.current(value);
      return;
    }
    let t0: number | null = null;
    const step = (now: number) => {
      if (ticket.current !== id) return;
      if (t0 === null) t0 = now;
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtRef.current(value * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  const Comp = as as React.ElementType;
  return <Comp ref={ref} className={className} {...rest} />;
}