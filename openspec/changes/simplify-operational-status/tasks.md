## 1. Explicit Operational Refresh

- [x] 1.1 Remove the interval constant, polling hook, and polling registrations from the operations
  panel while retaining active-state badges and duplicate-action prevention.
- [x] 1.2 Add one accessible panel-level refresh control that refetches import, Linear, and cost
  status together, reflects aggregate fetching state, and preserves the existing per-card errors.
- [x] 1.3 Confirm rescan, synchronization, and recalculation mutations still invalidate and refresh
  their relevant cached status and usage data without starting periodic requests.

## 2. Concise Import Status

- [x] 2.1 Derive attention checkpoints from non-ready state, nonzero unknown or malformed record
  counts, or a sanitized last error.
- [x] 2.2 Keep the total root and checkpoint counts visible, omit healthy checkpoint source rows, and
  render the existing sanitized details only for attention checkpoints.

## 3. Regression Coverage and Verification

- [x] 3.1 Add operations-panel tests proving that explicit refresh requests all three statuses,
  exposes pending refresh state, and does not install periodic status requests.
- [x] 3.2 Add operations-panel tests proving healthy checkpoints contribute to the total without
  being listed and each attention condition preserves the appropriate sanitized detail.
- [x] 3.3 Run frontend formatting, linting, type checking, tests, and build verification.
