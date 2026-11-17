import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui Dialog (Radix), presented as the design's right-hand drawer.
 *  Keeps focus trapping, Escape-to-close and scroll locking for free. */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="backdrop" />
      <DialogPrimitive.Content data-slot="drawer-content" className={cn("drawer", className)} {...props}>
        <DialogPrimitive.Close className="close" aria-label="Close">
          ✕
        </DialogPrimitive.Close>
        <div className="drawer-body">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogDescription, DialogTitle, DialogTrigger, DrawerContent };