## 1. Desktop Presentation

- [x] 1.1 Simplify the authored application shell to persistent issue and session navigation by removing mobile navigation state, toggle controls, mobile-only icons, and close handlers.
- [x] 1.2 Give the authored application surface a 1024 CSS-pixel minimum width and replace mobile visibility, spacing, grid, panel, and table-stacking branches with the supported desktop presentation while preserving bounded overflow and long-value safeguards.
- [x] 1.3 Confirm that the issue overview, issue detail, sessions view, operations panel, and dialogs retain every required identity, metric, warning, action, and status at the minimum supported width.

## 2. Contract and Automated Coverage

- [x] 2.1 Update mirrored shell tests to require persistent primary navigation and verify that no mobile navigation toggle is exposed.
- [x] 2.2 Replace the iPhone Playwright project with a desktop Chromium project configured at the 1024-pixel support boundary, retaining the existing critical flows and page-level overflow assertion.
- [x] 2.3 Update frontend documentation to declare the 1024 CSS-pixel minimum, remove mobile/responsive support claims, and describe desktop-only browser verification.

## 3. Verification

- [x] 3.1 Run frontend formatting, lint, type checking, and Bun tests without modifying generated API files.
- [x] 3.2 Run the frontend build and desktop Playwright suite, confirming the critical dashboard routes have no page-level horizontal overflow at 1024 CSS pixels.

## 4. Fixed Presentation Density

- [x] 4.1 Remove the compact/comfortable density control, shell-store integration, root density classes, and compact-specific style override so the shell always uses the former comfortable spacing.
- [x] 4.2 Delete the density-only Zustand store and remove the now-unused Zustand dependency through the frontend workspace package manager so the lockfile is updated consistently.
- [x] 4.3 Replace the density-state shell test with assertions that no compact or comfortable density control is exposed, and update frontend capability, state-ownership, structure, and testing documentation.

## 5. Revised Verification

- [x] 5.1 Run frontend formatting, lint, type checking, Bun tests, and build without modifying generated API files.
- [x] 5.2 Run the desktop Playwright suite and reconfirm the fixed comfortable-derived layout has no page-level horizontal overflow at 1024 CSS pixels.
