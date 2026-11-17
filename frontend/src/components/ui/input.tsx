import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Input, dressed as the design's rounded search field. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn("search", className)} {...props} />;
}

export { Input };