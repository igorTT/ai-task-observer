export const PAGE_SIZE = 20;

export function parsePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/u.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

export function pageOffset(page: number): number {
  return (Math.max(1, page) - 1) * PAGE_SIZE;
}

export function totalPages(total: string | number): number {
  const count = typeof total === "string" && /^\d+$/u.test(total) ? BigInt(total) : BigInt(total);
  return Number((count + BigInt(PAGE_SIZE - 1)) / BigInt(PAGE_SIZE));
}

export function useUrlPage(): [number, (page: number) => void] {
  const [parameters, setParameters] = useSearchParams();
  const rawPage = parameters.get("page");
  const page = parsePage(rawPage);
  useEffect(() => {
    if (rawPage !== null && (page === 1 || rawPage !== String(page))) {
      setParameters({}, { replace: true });
    }
  }, [page, rawPage, setParameters]);
  return [page, (next) => setParameters(next <= 1 ? {} : { page: String(next) })];
}
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
