import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Button, dressed in the design's pill buttons. */
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "",
      yellow: "yellow",
      ghost: "ghost",
      send: "send",
    },
  },
  defaultVariants: { variant: "default" },
});

function Button({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export { Button, buttonVariants };