## Context

See `proposal.md` for motivation and the delta specs for observable behavior. Shared usage metric
state is currently rendered from the issue feature and reused by session views. It emits healthy
and warning badges alike, while anomaly and pricing-gap codes are only converted into readable
labels. The frontend has a basic badge primitive and one Radix-based shadcn-style component, but no
tooltip primitive or centralized usage-warning explanations.

## Goals / Non-Goals

**Goals:**

- Make healthy usage state visually quiet without removing metric values.
- Provide one reusable, accessible tooltip composition for warning badges.
- Keep warning labels and explanations deterministic, sanitized, and independently testable.
- Allow future warning codes to degrade safely without requiring synchronized frontend releases.

**Non-Goals:**

- Turning warning badges or tooltips into remediation controls.
- Applying the new warning-only rule to attribution and operational state.
- Changing the API contract or deriving new warning conditions in the browser.

## Decisions

### Add a shadcn-style tooltip primitive backed by Radix

Add `@radix-ui/react-tooltip` as a direct frontend dependency and implement a thin primitive in the
shared UI layer that exports provider, root, trigger, and styled portal content. Mount one provider
around the application so delay and interaction behavior are consistent across current and future
tooltips.

Radix supplies pointer and focus behavior, portal positioning, collision handling, and accessible
relationships. The wrapper owns project styling and a small side offset while callers own the
trigger and explanatory content.

Alternative: use the native `title` attribute. Rejected because its keyboard, timing, styling, and
test behavior are inconsistent and it does not establish a reusable project pattern.

Alternative: implement positioning and dismissal directly with React state. Rejected because that
duplicates mature accessibility and overlay behavior.

### Compose a generic WarningBadge from existing primitives

Add a shared `WarningBadge` component that accepts a visible label and explanation, renders the
existing amber badge as the tooltip trigger, and makes the trigger keyboard-focusable. Each badge
owns one tooltip root so several adjacent warnings can be focused and explained independently.
Callers do not repeat provider, trigger, portal, or content markup.

The component remains presentation-only: it does not interpret API codes or decide whether a
warning exists. This keeps it reusable for warning badges outside usage metrics without coupling
the UI layer to generated response types.

Alternative: add tooltip props directly to `Badge`. Rejected because most badges are passive
labels and should not acquire focus or overlay behavior by default.

### Centralize usage-warning descriptions separately from presentation

Create a usage-warning description catalog outside the UI primitive. It will cover the synthetic
states `partial_tokens`, `partial_estimate`, and `cost_unavailable`, plus every currently emitted
token anomaly and pricing-gap code. Lookup returns a fixed explanation for known codes and a fixed
generic sanitized explanation for unknown codes; it never interpolates opaque backend content into
tooltip text.

Visible API-code labels continue to use the existing sanitized code formatter. Synthetic warning
states use their established product labels. Metric rendering will de-duplicate warning codes
before producing badges while preserving deterministic order.

Alternative: place descriptions inline beside each badge branch. Rejected because the same codes
appear on issue, model, daily, and session summaries and inline text would drift.

Alternative: return explanations from the backend. Rejected because these are presentation strings,
the API already provides stable sanitized codes, and this change does not need a contract update.

### Render only warnings from shared metric state

Shared metric state will construct warnings as follows:

- add `partial_tokens` only when token completeness is false;
- add `partial_estimate` when cost is incomplete but a known estimate exists;
- add `cost_unavailable` when cost is incomplete and the estimate is null; and
- append distinct anomaly and pricing-gap codes.

When that collection is empty, the component returns no badge container. Metric grids and the
session estimated-cost value continue to render independently. This changes every current consumer
of shared usage metric state consistently, rather than special-casing the session page.

Alternative: suppress success badges only on sessions. Rejected because identical metric state
would then use conflicting visual semantics across dashboard routes.

## Risks / Trade-offs

- [Tooltips hide essential context on unsupported touch interactions] → Keep visible badge labels
  meaningful on their own; tooltips add explanation but are not required to identify the warning.
- [Focusable spans may be confusing to assistive technology] → Give the trigger an accessible
  description relationship through Radix, verify focus behavior, and avoid button semantics because
  the badge performs no action.
- [New backend warning codes lack tailored copy] → Preserve a sanitized visible label and fixed
  generic tooltip until the catalog is extended.
- [Catalog copy drifts from warning semantics] → Cover every currently emitted code with focused
  tests and keep the catalog adjacent to usage presentation rather than the generic UI primitive.
- [A global provider affects unrelated future tooltips] → Limit provider configuration to shared
  timing defaults; positioning and content remain local to each tooltip.

## Migration Plan

1. Add the Radix tooltip dependency and shared primitive.
2. Add the generic warning badge and usage-warning catalog with focused tests.
3. Replace shared metric-state badge rendering and update its consumers' regression tests.
4. Run frontend formatting, lint, type checks, tests, and build, followed by repository verification.

Rollback removes the new provider, components, catalog, dependency, and lockfile entry, then
restores the previous shared metric-state rendering. No persisted data or API migration is involved.

