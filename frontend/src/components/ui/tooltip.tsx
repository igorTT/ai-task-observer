import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function TooltipProvider(properties: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider {...properties} />;
}

export function Tooltip(properties: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...properties} />;
}

export function TooltipTrigger(properties: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...properties} />;
}

export function TooltipContent({
  className,
  sideOffset = 4,
  ...properties
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-xs rounded-md bg-slate-950 px-3 py-1.5 text-xs text-white shadow-md",
          className,
        )}
        {...properties}
      />
    </TooltipPrimitive.Portal>
  );
}
