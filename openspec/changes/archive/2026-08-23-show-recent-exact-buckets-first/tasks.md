## 1. Exact Bucket Table Presentation

- [x] 1.1 Render Exact bucket data rows from the latest interval to the earliest without mutating
  the shared timeline bucket array or changing chart order.
- [x] 1.2 Remove the dedicated Completeness header and cells while retaining incomplete and
  unavailable annotations alongside their affected token and estimated-cost values.

## 2. Regression Coverage

- [x] 2.1 Update the overview feature test to assert reverse-chronological Exact bucket row order
  and the Interval, Tokens, and Estimated cost column set without a Completeness column.
- [x] 2.2 Cover incomplete or unavailable bucket metrics and verify their accessible inline state
  remains present after the dedicated field is removed.

## 3. Verification

- [x] 3.1 Run focused frontend overview tests and resolve any regressions.
- [x] 3.2 Run frontend type checking, linting, and formatting checks for the authored changes.
