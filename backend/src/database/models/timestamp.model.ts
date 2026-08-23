import type { DuckDBDateValue, DuckDBTimestampTZValue } from "@duckdb/node-api";
import { DuckDBDateValue as DuckDBDateValueClass } from "@duckdb/node-api";
import { DuckDBTimestampTZValue as DuckDBTimestampTZValueClass } from "@duckdb/node-api";

const MILLISECONDS_PER_DAY = 86_400_000;
const MIN_DATE_MILLISECONDS = -8_640_000_000_000_000n;
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000n;

export function mapTimestampWithTimeZone(value: DuckDBTimestampTZValue): Date {
  if (!(value instanceof DuckDBTimestampTZValueClass) || !value.isFinite) {
    throw new TypeError("Expected a finite DuckDB TIMESTAMPTZ value");
  }
  const milliseconds = value.micros / 1_000n;
  if (milliseconds < MIN_DATE_MILLISECONDS || milliseconds > MAX_DATE_MILLISECONDS) {
    throw new RangeError("DuckDB TIMESTAMPTZ value is outside the JavaScript Date range");
  }
  return new Date(Number(milliseconds));
}

export function mapNullableTimestampWithTimeZone(
  value: DuckDBTimestampTZValue | null,
): Date | null {
  return value === null ? null : mapTimestampWithTimeZone(value);
}

export function mapDateAsUtc(value: DuckDBDateValue): Date {
  if (
    !(value instanceof DuckDBDateValueClass) ||
    !value.isFinite ||
    !Number.isInteger(value.days)
  ) {
    throw new TypeError("Expected a finite DuckDB DATE value");
  }
  const milliseconds = value.days * MILLISECONDS_PER_DAY;
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < Number(MIN_DATE_MILLISECONDS) ||
    milliseconds > Number(MAX_DATE_MILLISECONDS)
  ) {
    throw new RangeError("DuckDB DATE value is outside the JavaScript Date range");
  }
  return new Date(milliseconds);
}

export function mapNullableDateAsUtc(value: DuckDBDateValue | null): Date | null {
  return value === null ? null : mapDateAsUtc(value);
}
