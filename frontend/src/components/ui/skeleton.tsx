import type * as React from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder in the design's soft grey. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };