import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...properties }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium",
        className,
      )}
      {...properties}
    />
  );
}
