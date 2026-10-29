"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn's Popover, styled with this project's tokens rather than shadcn's
 * defaults. Radix supplies the behaviour that is genuinely hard — focus
 * trapping, outside-click, escape, collision-aware placement — and the look
 * comes from .panel like every other surface here.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "panel z-50 w-auto p-3 outline-none",
          // Radix sets data-state and the transform origin; the panel scales
          // out of its trigger instead of appearing from nowhere.
          "origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-[popover-in_200ms_var(--ease-out)_both]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
