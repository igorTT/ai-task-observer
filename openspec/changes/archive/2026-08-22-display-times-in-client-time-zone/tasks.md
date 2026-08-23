## 1. Client-Zone Timestamp Formatting

- [x] 1.1 Replace the UTC-specific shared timestamp formatter with a browser-zone date-time formatter that preserves the fixed display styles and unknown-time fallback and supports deterministic zone injection in tests.
- [x] 1.2 Update the session, issue-detail, and operation timestamp consumers to use the renamed formatter while leaving UTC daily-usage date rendering and labeling unchanged.

## 2. Verification

- [x] 2.1 Extend frontend formatter tests to cover a known IANA zone, a timestamp that crosses a local calendar boundary, and absent or invalid timestamp fallbacks.
- [x] 2.2 Run frontend formatting, lint, type checking, tests, and build verification and confirm no generated API artifacts change.
