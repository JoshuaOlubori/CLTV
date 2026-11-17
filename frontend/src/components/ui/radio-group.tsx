import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui RadioGroup (Radix), dressed as the design's bordered choices. */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("choice", className)} {...props} />;
}

function RadioItem({
  className,
  title,
  hint,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { title: string; hint: string }) {
  return (
    <label>
      <RadioGroupPrimitive.Item data-slot="radio-item" className={cn("radio-dot", className)} {...props}>
        <RadioGroupPrimitive.Indicator>
          <span />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      <span>
        <b>{title}</b>
        <small>{hint}</small>
      </span>
    </label>
  );
}

export { RadioGroup, RadioItem };