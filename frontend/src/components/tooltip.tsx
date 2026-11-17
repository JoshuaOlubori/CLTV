import { useEffect, useRef } from "react";

/** The design's pointer-following tooltip. Any element with a `data-tip`
 *  attribute (HTML allowed: <b>, <br>) shows it while hovered. */
export function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    const onMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-tip]");
      if (!el) {
        tip.hidden = true;
        return;
      }
      tip.innerHTML = el.getAttribute("data-tip") ?? "";
      tip.hidden = false;
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8) + "px";
      tip.style.top =
        (e.clientY + 18 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 18) + "px";
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return <div ref={ref} className="tip" hidden />;
}