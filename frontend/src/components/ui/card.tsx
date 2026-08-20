import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...properties }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border bg-white p-5 shadow-sm", className)} {...properties} />
  );
}
