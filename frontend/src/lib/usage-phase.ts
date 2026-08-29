import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { UsageTimelineSessionPhaseResponse } from "@/api/generated/api";

export type UsagePhase = "all" | UsageTimelineSessionPhaseResponse;

const phases: readonly UsageTimelineSessionPhaseResponse[] = [
  "research",
  "explore",
  "proposal",
  "apply",
  "verify",
  "quick-flow",
  "other",
  "unassigned",
];

export function parseUsagePhase(value: string | null | undefined): UsagePhase {
  return value && phases.some((phase) => phase === value)
    ? (value as UsageTimelineSessionPhaseResponse)
    : "all";
}

export function usagePhaseFromSearch(search: string): UsagePhase {
  return parseUsagePhase(new URLSearchParams(search).get("phase"));
}

export function usagePhaseLabel(phase: UsagePhase): string {
  if (phase === "all") return "All";
  if (phase === "quick-flow") return "Quick flow";
  if (phase === "unassigned") return "Unassigned";
  return phase[0]!.toUpperCase() + phase.slice(1);
}

export function usagePhaseQueryValue(
  phase: UsagePhase,
): UsageTimelineSessionPhaseResponse | undefined {
  return phase === "all" ? undefined : phase;
}

export function usageSearchForPhase(search: string, phase: UsagePhase): string {
  const parameters = new URLSearchParams(search);
  parameters.delete("phase");
  if (phase !== "all") parameters.set("phase", phase);
  return parameters.toString();
}

export function useUsagePhase(): readonly [UsagePhase, (phase: UsagePhase) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const rawPhase = useMemo(
    () => new URLSearchParams(location.search).get("phase"),
    [location.search],
  );
  const phase = parseUsagePhase(rawPhase);

  useEffect(() => {
    if (rawPhase === null || parseUsagePhase(rawPhase) !== "all") return;
    const parameters = new URLSearchParams(location.search);
    parameters.delete("phase");
    const search = parameters.toString();
    void navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, rawPhase]);

  const setPhase = useCallback(
    (nextPhase: UsagePhase) => {
      const search = usageSearchForPhase(location.search, nextPhase);
      void navigate({ pathname: location.pathname, search: search ? `?${search}` : "" });
    },
    [location.pathname, location.search, navigate],
  );
  return [phase, setPhase];
}
