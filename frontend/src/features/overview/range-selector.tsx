import type { UsageRange } from "@/lib/usage-range";

const options: readonly { value: UsageRange; label: string }[] = [
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
];

export function UsageRangeSelector({
  value,
  onChange,
}: {
  value: UsageRange;
  onChange: (value: UsageRange) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <span>Recent usage range</span>
      <select
        className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        name="usage-range"
        value={value}
        onChange={(event) => onChange(event.target.value as UsageRange)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
