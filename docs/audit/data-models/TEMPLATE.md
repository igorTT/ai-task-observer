# Model Name

## Purpose

Describe what the model represents and what it must not represent.

## Ownership and Source of Truth

Identify the owner, authoritative inputs, derived fields, and mutation boundary.

## Current Lifecycle

Describe creation, updates, invalidation, rebuild, retention, and deletion.

## Relationships

List inbound and outbound relationships and their cardinality.

## Current Fields

| Field | Source | Current readers | Current writers | Classification | Notes |
| ----- | ------ | --------------- | --------------- | -------------- | ----- |

Use one of these classifications:

- **Keep**: required by current or accepted MVP behavior.
- **Replace**: the concept is needed but the current representation is wrong.
- **Move**: the field belongs to a different model.
- **Derive**: the value should be calculated from an authoritative source.
- **Drop**: no accepted behavior requires the field.
- **Review**: evidence or product semantics are still incomplete.

## Evidence

Record code references, persisted-data measurements, query plans, contract behavior, and tests.

## Confirmed Decisions

List only decisions explicitly accepted during the audit.

## Open Questions

List unresolved semantics, naming, ownership, migration, and compatibility questions.

## Impact Surface

List affected migrations, repositories, services, API contracts, generated files, frontend views,
tests, canonical specs, and active changes.
