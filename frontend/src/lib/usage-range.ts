import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type UsageRange = "12h" | "24h";

export function parseUsageRange(value: string | null | undefined): UsageRange {
  return value === "24h" ? "24h" : "12h";
}

export function usageRangeFromSearch(search: string): UsageRange {
  return parseUsageRange(new URLSearchParams(search).get("range"));
}

export function canonicalUsageSearch(search: string): string {
  const parameters = new URLSearchParams(search);
  if (parameters.get("range") !== null && parseUsageRange(parameters.get("range")) === "12h") {
    parameters.delete("range");
  }
  return parameters.toString();
}

export function usageSearchForRange(search: string, range: UsageRange): string {
  const parameters = new URLSearchParams(search);
  parameters.delete("range");
  if (range === "24h") parameters.set("range", range);
  return parameters.toString();
}

export function useUsageRange(): readonly [UsageRange, (range: UsageRange) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const rawRange = useMemo(
    () => new URLSearchParams(location.search).get("range"),
    [location.search],
  );
  const range = parseUsageRange(rawRange);

  useEffect(() => {
    if (rawRange === null || rawRange === "24h") return;
    const search = canonicalUsageSearch(location.search);
    void navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, rawRange]);

  const setRange = useCallback(
    (nextRange: UsageRange) => {
      const search = usageSearchForRange(location.search, nextRange);
      void navigate({ pathname: location.pathname, search: search ? `?${search}` : "" });
    },
    [location.pathname, location.search, navigate],
  );
  return [range, setRange];
}
