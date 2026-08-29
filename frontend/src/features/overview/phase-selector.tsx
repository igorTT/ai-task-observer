import { usagePhaseLabel, type UsagePhase } from "@/lib/usage-phase";

const options: readonly UsagePhase[] = [
  "all",
  "research",
  "explore",
  "proposal",
  "apply",
  "verify",
  "quick-flow",
  "other",
  "unassigned",
];

export function UsagePhaseSelector({
  value,
  onChange,
}: {
  value: UsagePhase;
  onChange: (value: UsagePhase) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <span>Current session phase</span>
      <select
        className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        name="usage-phase"
        value={value}
        onChange={(event) => onChange(event.target.value as UsagePhase)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {usagePhaseLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
