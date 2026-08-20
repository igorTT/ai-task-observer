import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...properties }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} {...properties} />;
}
