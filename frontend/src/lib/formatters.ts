const DECIMAL_INTEGER = /^-?\d+$/u;

export function formatDecimalCount(value: string): string {
  if (!DECIMAL_INTEGER.test(value)) return "Unavailable";
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).replace(/^0+(?=\d)/u, "");
  return `${negative ? "−" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}`;
}

export function formatNullableCount(value: string | null): string {
  return value === null ? "Unavailable" : formatDecimalCount(value);
}

export function formatUsd(value: string | null): string {
  if (value === null || !/^\d+(?:\.\d+)?$/u.test(value)) return "Unavailable";
  const [whole = "0", fraction = ""] = value.split(".");
  const padded = `${fraction}0000`;
  const rounded = BigInt(whole) * 100n + BigInt(padded.slice(0, 2));
  const carry = padded[2] && padded[2] >= "5" ? 1n : 0n;
  const cents = rounded + carry;
  return `$${formatDecimalCount((cents / 100n).toString())}.${(cents % 100n)
    .toString()
    .padStart(2, "0")}`;
}

export function formatUtcDate(value: string | null | undefined): string {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Unknown time";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
    timeZone: "UTC",
  }).format(parsed);
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "Unavailable";
  const milliseconds = new Date(end).valueOf() - new Date(start).valueOf();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Unavailable";
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function formatCode(code: string): string {
  const safe = code.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 80);
  if (!safe) return "Unknown warning";
  return safe.replace(/[_-]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
