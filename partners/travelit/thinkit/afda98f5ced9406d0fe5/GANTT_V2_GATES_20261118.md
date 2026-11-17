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
