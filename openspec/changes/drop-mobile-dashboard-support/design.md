## Context

The current dashboard implements narrow-screen behavior in three coupled places: the application
shell owns collapsible-navigation state, shared styles switch navigation and tables into mobile
presentations, and Playwright repeats the critical suite with an iPhone device profile. The
archived `usage-dashboard` specification also promises usable narrow and wide presentations.
The same shell exposes compact/comfortable density state through a Zustand store; this is the
store's only responsibility and Zustand has no other frontend consumer.

The frontend remains browser-delivered by the backend and continues to consume only the generated
HTTP client. This change has no server-side or persistence implications.

## Goals / Non-Goals

**Goals:**

- Establish one explicit desktop support floor of 1024 CSS pixels across the contract,
  implementation, documentation, and browser tests.
- Remove mobile-only interaction state and presentation rules.
- Remove density-selection state and standardize the dashboard on the current comfortable spacing.
- Retain layout resilience, complete information, and accessibility within supported desktop
  widths.

**Non-Goals:**

- Detecting user agents or preventing the application from loading below the support floor.
- Guaranteeing a particular failure presentation on unsupported viewports.
- Removing flexible sizing, wrapping, or component-local overflow that improves desktop behavior.
- Replacing the density selector with another display-preference mechanism.
- Altering routes, dashboard data, mutations, backend APIs, or generated files.

## Decisions

### 1. Define support by viewport width, not device type

The supported range begins at 1024 CSS pixels. Documentation and tests will express the boundary
in CSS pixels because device categories and user-agent identities do not reliably describe the
space available to the layout.

The application will not show an unsupported-device gate. Below the boundary, behavior is simply
unspecified. This removes support obligations without adding another responsive screen that would
itself require mobile design and testing.

**Alternatives considered:** Keeping the current 768-pixel `md` boundary was rejected because it
still includes tablet-oriented layout constraints. Using user-agent detection was rejected because
desktop windows can be narrow and mobile browsers can request desktop identities. A blocking notice
was rejected because it introduces new narrow-screen behavior rather than removing it.

### 2. Remove mobile-specific branches while retaining desktop resilience

The shell will render primary navigation persistently and remove its open/closed state, toggle,
mobile-only icons, and close-on-navigation handlers. Shared presentation styles will use the desktop
header, page spacing, metric and record grids, operations panel, and semantic tables directly. The
mobile table-to-stacked-record media query and mobile visibility rules will be removed.

The root application surface will have a 1024-pixel minimum width so unsupported smaller windows do
not silently trigger a second designed layout. Component-level wrapping, word breaking, and
table-container overflow remain appropriate safeguards for long values and desktop zoom; they are
not treated as mobile support.

**Alternatives considered:** Leaving dormant mobile CSS in place was rejected because it preserves
maintenance burden and obscures the support boundary. Removing all flexible layout primitives was
rejected because ordinary desktop resizing, zoom, and unpredictable content still require resilient
CSS.

### 3. Verify the support boundary with desktop browser coverage

Playwright will use a desktop Chromium project rather than paired desktop and iPhone projects. The
critical dashboard flow will be exercised at the 1024-pixel minimum and assert that the document
does not overflow horizontally. Existing behavioral end-to-end scenarios remain; only redundant
mobile-device execution is removed. Focused shell tests will assert persistent navigation and the
absence of a navigation toggle.

**Alternatives considered:** Keeping the iPhone project but declaring its failures non-blocking was
rejected because it would continue to imply mobile compatibility. Testing only a typical 1280-pixel
desktop was rejected because it would leave the documented lower bound unverified.

### 4. Standardize on the current comfortable density

The shell will render with the current comfortable spacing unconditionally. The density button,
compact/comfortable root classes, compact-specific style override, Zustand shell store, and
density-state test will be removed. Because the shell store is Zustand's only consumer, the Zustand
package and lockfile entries will also be removed rather than retaining an unused dependency.

Shell coverage will assert that neither compact nor comfortable density controls are exposed. The
desktop-boundary browser flow continues to verify the resulting fixed layout at 1024 CSS pixels.

**Alternatives considered:** Standardizing on compact spacing was rejected because comfortable is
the existing default and therefore minimizes presentation change for users who never selected the
preference. Keeping the store for possible future preferences was rejected because speculative
state and dependencies add maintenance surface without a current requirement. Persisting a legacy
density choice was rejected because the density concept is being removed completely.

## Risks / Trade-offs

- **[Users opening the dashboard in a narrow window will encounter horizontal scrolling or clipped
  presentation]** → State the 1024-pixel minimum in user-facing documentation and do not claim a
  graceful unsupported-width experience.
- **[Removing breakpoint rules can accidentally regress the 1024-pixel boundary]** → Run the
  critical navigation and overflow checks at exactly 1024 pixels.
- **[A blanket removal of responsive utilities could harm desktop zoom and long-content handling]**
  → Remove only intentional mobile branches and retain bounded overflow, wrapping, and word-break
  safeguards.
- **[Accessibility could be mistaken for mobile-only work]** → Preserve keyboard, focus, semantic
  table, dialog, and live-region behavior and their existing tests.
- **[Comfortable spacing could crowd the 1024-pixel boundary after compact mode is removed]** →
  Exercise all critical views at the exact support floor and retain component-local overflow for
  dense tables and long values.

## Migration Plan

1. Simplify the shell and shared styles to the fixed-density desktop presentation.
2. Remove the density-only store and Zustand dependency, updating the lockfile through the package
   manager.
3. Replace narrow-device and density-selection expectations with desktop-boundary shell checks.
4. Update the frontend support and state-ownership documentation and run focused frontend
   verification.

Rollback restores the navigation and density state, responsive style branches, Zustand dependency,
narrow Playwright project, and prior narrow-and-wide presentation contract. No data or API
migration is required.
