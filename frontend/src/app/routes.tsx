import { Activity } from "lucide-react";
import { Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shell-store";

export function ApplicationShell() {
  const compactMode = useShellStore((state) => state.compactMode);
  const toggleCompactMode = useShellStore((state) => state.toggleCompactMode);
  return (
    <div className={compactMode ? "mx-auto max-w-4xl p-4" : "mx-auto max-w-6xl p-8"}>
      <header className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Activity aria-hidden="true" className="text-primary" />
          <span className="font-semibold">AI Task Observer</span>
        </div>
        <Button variant="outline" size="sm" onClick={toggleCompactMode}>
          {compactMode ? "Comfortable view" : "Compact view"}
        </Button>
      </header>
      <main className="py-12">
        <Outlet />
      </main>
    </div>
  );
}

export function HomeRoute() {
  return (
    <section className="max-w-2xl space-y-4">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Foundation ready</p>
      <h1 className="text-4xl font-bold tracking-tight">Understand the work behind every issue.</h1>
      <p className="text-lg text-slate-600">
        Codex session usage will appear here after the ingestion and Linear attribution capabilities
        are added.
      </p>
    </section>
  );
}
