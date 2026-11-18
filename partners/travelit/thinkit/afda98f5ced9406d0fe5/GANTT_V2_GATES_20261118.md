# TravelIt Gantt v2 — owner acceptance gates (18 November 2026)

This is a draft candidate, not a deployed change.

## Fit and fullscreen
- Entire day (including late overnight finishes) or entire trip timeline visible in the available chart width on both MacBook and iPhone, with **no horizontal time-axis scrolling**.
- Tick labels thin as needed on narrow screens; displayed bars use the *same model coordinate system* as axis ticks.
- Gantt fullscreen toggle occupies the connected iframe and its parent host in iOS Safari, while preserving an always-visible Exit control and Escape on Mac. It must release the host class when leaving the workspace.

## Direct scheduling
- Edit Date, Start, Duration directly in each Gantt row. End is calculated from Start plus Duration, including next-day indication.
- Multiple row edits are staged locally. One Save schedule commits changes atomically with expected epoch, workspace and per-record revisions. Stale data or failed write leaves drafts intact.
- Optional predecessor controls (FS, SS, FF, SF, signed lag) can be shown or hidden. Existing additional predecessor links are preserved, and further links remain editable in Activity details.
- Predecessor-derived Start is previewed *before* save; chains, fixed bookings, cycles, time bounds and missing predecessors are validated. Fixed bookings are never silently shifted.

## OneDrive data safety
- No automatic new library, schema migration, OneDrive disconnect, deletion, or original-file rewrite.
- This PR must be reconciled with PR #48 (desktop Gantt alignment) and must not replace the live owner Mac diagnostic PR #47.
- Browser fixtures and automated CI do not prove that MacBook-to-iPhone real OneDrive write/readback works.

## Required tests
- PDM derivation unit tests for all four relation types, blank starts, multiple links, fixed constraints, cycles, cross-midnight.
- 390 px iPhone and desktop Chromium/WebKit: whole timeline fits, controls readable, Start/Duration edit updates End, save/reload retains changes, fullscreen enters/exits without clipping.
- Full connected suite: KeepIt native note, LiveIt events, TravelIt cloud-persistence simulations, Microsoft callback and reconnection.

## Regenerated candidate checkpoint

- Gantt fit model now draws clock ticks, gridlines and bars from the *same* normalized timeline coordinates. The old unrelated repeating 25%-column grid has been replaced.
- Reproducible pinned build completed on the latest edited source. The compiler bot refreshed the fingerprinted startup bundle and owner release proof. First-party browser regression must run against the **postcompiler source SHA**, not the preceding unrebuilt CSS/JS commit; all those initial provenance failures are expected and non-acceptance.
- The candidate remains draft; no owner OneDrive file was accessed or changed.

## Final fitted-axis source checkpoint

- On iPhone, place the compact edit fields above each activity's **full-width horizontal timeline**, not in a narrow side column. This preserves a useful chart width without time-axis scrolling.
- On desktop, reserve approximately 64% of Gantt width for the same full-span timeline and derive vertical gridlines from actual tick positions. PR #48's separate desktop alignment proposal was closed unmerged; these compatible alignment principles are incorporated here to avoid competing releases.
- Pinned source rebuild and owner release manifest regeneration succeeded on the feature branch. Browser acceptance must use this *postcompiler* source SHA. CSS, editor JS and PDM model are draft only; do not deploy until all acceptance gates pass.

## Reconciled KeepIt baseline

This successor branch begins at main commit `0e1a4112c8a8b482905d9aa99946043e43f4ad57` (Mac-safe OneDrive catalog readback). No older OneDrive bundle or owner manifest was copied from the predecessor branch. The branch compiler must regenerate TravelIt and preserve the Mac recovery source and content hashes. This branch supersedes overlapping PR #49 for release purposes.

## Postcompiled WebKit 320px check

A pinned Playwright container caught a 2px document-name collision with the shared ThinkIt header at 320px (bar ends at y=50; field starts at y=48). The candidate adds 4px separation only to that embedded ThinkIt frame. The deterministic compiler re-hashed `partners/connected/connected-nav.css` in the owner manifest. This documentation change triggers the full browser suite **after** the compiler commit so the exact hash and source are verified together. No owner records were modified.
