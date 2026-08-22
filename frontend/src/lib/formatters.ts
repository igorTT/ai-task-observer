const DECIMAL_INTEGER = /^-?\d+$/u;
const NON_NEGATIVE_DECIMAL_INTEGER = /^\d+$/u;
const COMPACT_TOKEN_UNITS = [
  { suffix: "k", power: 3 },
  { suffix: "m", power: 6 },
  { suffix: "b", power: 9 },
  { suffix: "t", power: 12 },
] as const;

export function formatDecimalCount(value: string): string {
  if (!DECIMAL_INTEGER.test(value)) return "Unavailable";
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).replace(/^0+(?=\d)/u, "");
  return `${negative ? "−" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}`;
}

export function formatNullableCount(value: string | null): string {
  return value === null ? "Unavailable" : formatDecimalCount(value);
}

export function formatCompactTokenCount(value: string | null): string {
  if (value === null || !NON_NEGATIVE_DECIMAL_INTEGER.test(value)) return "Unavailable";

  const digits = value.replace(/^0+(?=\d)/u, "");
  const unitIndex = Math.min(Math.floor((digits.length - 1) / 3), COMPACT_TOKEN_UNITS.length);
  if (unitIndex === 0) return formatDecimalCount(digits);

  const unit = COMPACT_TOKEN_UNITS[unitIndex - 1];
  if (!unit) return "Unavailable";
  const wholeLength = digits.length - unit.power;
  const whole = digits.slice(0, wholeLength);
  const fractionDigit = digits[wholeLength];

  if (BigInt(whole) < 100n && fractionDigit && fractionDigit !== "0") {
    return `${whole}.${fractionDigit}${unit.suffix}`;
  }
  return `${whole}${unit.suffix}`;
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
