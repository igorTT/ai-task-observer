## Context

See `proposal.md` for motivation. API timestamp fields are serialized ISO instants, and the shared
frontend formatter currently forces them into UTC before the session, issue, and operation views
render them. Issue daily-usage entries are different: their date field is a backend-defined UTC
calendar bucket, rendered directly rather than as an instant. The existing fixed `en` display
locale and `Unknown time` fallback are established presentation behavior.

## Goals / Non-Goals

**Goals:**

- Centralize browser-zone formatting for every currently rendered timestamp instant.
- Preserve instant semantics and daylight-saving behavior through the platform date-time APIs.
- Keep the distinction between timestamp instants and UTC calendar-bucket identifiers explicit in
  naming, call sites, and tests.
- Make time-zone conversion testable without depending on the developer machine's zone.

**Non-Goals:**

- Introducing application time-zone state, a user-selectable preference, or automatic refresh when
  the operating-system zone changes without a React render.
- Changing locale selection, relative-time presentation, API timestamp formats, persistence, or
  backend aggregation.

## Decisions

### Use the browser-resolved time zone in the shared instant formatter

Rename the UTC-specific formatter to describe date-time presentation rather than a storage zone,
and format valid timestamp instants with the browser's current resolved time zone. Retain the
medium-date and short-time styles and the fixed `en` locale so the change affects only the time
zone. Resolve or apply the zone when formatting instead of caching formatted values, allowing later
renders to follow the browser's then-current zone and letting `Intl.DateTimeFormat` handle daylight
saving transitions.

An optional internal time-zone input may be used as a deterministic test seam, with production
callers relying on the browser-resolved default. This does not create application preference state.

**Alternatives considered:**

- Omitting the `timeZone` option and relying implicitly on the runtime default would produce the
  desired browser behavior, but an explicit resolved-zone boundary makes intent and deterministic
  testing clearer.
- Converting timestamps manually with fixed offsets was rejected because offsets do not correctly
  model daylight-saving and historical zone rules.
- Keeping the formatter named for UTC was rejected because it would misdescribe observable output
  and invite incorrect reuse.

### Keep UTC daily bucket dates outside instant formatting

Continue rendering issue daily-usage date strings as the UTC identifiers returned by the backend,
including the existing `Daily usage (UTC)` label. Do not construct a JavaScript `Date` from these
date-only values. A UTC bucket aggregates events assigned by backend rules; shifting its label could
show a local date whose metrics do not represent that local calendar day.

**Alternative considered:** Converting each daily label to a client-local date was rejected because
correct local-day reporting requires backend re-aggregation at time-zone-aware boundaries, which is
a separate capability and API contract.

### Verify conversion at the formatter boundary

Add formatter tests using a known IANA time zone and an instant that crosses a calendar boundary,
plus absent and invalid inputs. Existing view call sites remain thin consumers of the shared
formatter; type checking and focused frontend tests will verify the rename reaches all consumers.

**Alternative considered:** Snapshotting every consuming view was rejected because it duplicates
the same formatting assertion without improving coverage of the central conversion rule.

## Risks / Trade-offs

- [Displayed times vary by client] → This is the intended behavior; deterministic tests will supply
  a known zone rather than depend on the host environment.
- [Zone abbreviations can be ambiguous or locale-dependent] → Preserve the current concise format
  and do not add an abbreviation as part of this focused change.
- [A date-only UTC bucket is accidentally sent through the instant formatter later] → Keep UTC daily
  dates directly rendered and cover the distinction in the specification and tests.
- [A browser exposes UTC as its resolved zone for privacy or configuration reasons] → Treat the
  browser-exposed zone as authoritative; do not add geolocation or server inference.

## Migration Plan

Deploy as a frontend-only presentation change. No database, API, generated-client, or data migration
is required. Rollback consists of restoring the UTC formatter behavior and its call-site name; stored
timestamps and aggregation results remain unchanged.
