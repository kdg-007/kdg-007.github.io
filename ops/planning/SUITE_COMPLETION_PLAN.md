# Integrated suite completion plan

As of 13 November 2026 (Asia/Manila). Scope: ThinkIt, LiveIt, KeepIt and TravelIt.

## Outcome and ownership

Deliver the existing integrated suite for dependable everyday use, preserving existing work. LiveIt remains the primary launcher; KeepIt remains the shared repository. Maintain offline usefulness and the no-subscription requirement. Continue from the existing repository and published application.

The development assistant owns requirement reconciliation, implementation, integration, appropriate checks, publication and status updates. Owner involvement is limited to actual account/device access and concrete product decisions that cannot be resolved from existing instructions. Existing authorization covers routine fixes and publication.

## Baseline and corrections

Runtime baseline: d23e92d19cfb3460d981fc8c08d7aaadffe8bae1.

- Authentication/save recovery, device-copy fallback, BMC local backup restoration, readable ThinkIt controls and TravelIt map startup/foreground recovery have shipped. Retain their existing evidence.
- Automated synthetic cross-device checks are evidence of code behaviour, not proof of the owner's actual Microsoft account or physical Mac/iPhone.
- LiveIt already contains Projects/Operations task classification and filters in `app-8.js`. Verify and refine this implementation rather than assume it is absent.
- TravelIt already supports FS/SS/FF/SF relationships. `planTripDependencies()` currently requires a start time for the dependent activity; automatic timing from a predecessor therefore has a concrete remaining gap.
- Packing templates and trip deletion already exist. Check the actual requested workflows before rebuilding either.
- The earlier completion ledger groups several independent requests together. This plan separates them and keeps unproven closures open.

## Delivery sequence

| Batch | Deliverable | Completion evidence |
| --- | --- | --- |
| B1: Reliable shared data | Finish gaps in save/reopen, authentication/folder recovery, cross-device workspace and calendar synchronization, attachments and offline/conflict behaviour. | A saved object from each app and a linked original survive reopen, offline editing and reconnect; stale edits/deletions behave correctly. Retain an explicit separate owner-account Mac/iPhone gate. |
| B2: Complete trip planning | Excel saved import with complete useful content; readable itinerary/Gantt/calendar; dependency timing; ordering; trip deletion and clean Explore separation. | One complete trip can be imported, edited, reordered, scheduled, reopened and removed without losing unrelated destinations or shared files. |
| B3: Complete travel use | Packing, budgets, offline maps, route/stay/day workflows, documents and photographs. | The trip remains useful offline with its intentionally downloaded material, preserves its costs and packing state, and resumes safely online. |
| B4: Complete LiveIt daily use | Projects/Operations, capture/tasks/reminders/look-ahead/anniversaries, Work/Personal calendars and linked files. | A realistic Work/Personal day and multi-day trip flow survive reopen and sync; classification and privacy remain correct. |
| B5: Complete ThinkIt authoring | All diagram modes, collapsible structure, outline/mind-map ordering, long notes, BMC, rulers and printing. | A realistic multi-page project can be edited, reorganised, backed up/restored and printed with its content and dimensions retained. Physical calibration stays explicit until checked. |
| B6: Whole-suite completion | Consistent UI, responsive/device behaviour, startup/reopen performance, provider options and final requirement reconciliation. | Each requirement below has release/evidence references or a specific unresolved blocker. No item is silently dropped or described as closed solely because its code exists. |

Fix UI defects that obstruct a batch in that batch. B6 is the final consistency review, not a reason to postpone known usability defects.

B1 has first priority. If actual Microsoft-account testing is unavailable, finish the independent B1 code work and proceed through B2–B5. Keep the account gate visible and return to it when access is available; do not stop all development or substitute synthetic success for that gate.

## Requirement register

Baseline labels: **Shipped, scope checked** = specific behaviour has evidence, with broader acceptance still stated; **Partial** = implementation/refinement remains; **Exists, audit due** = code exists but requested workflow has not been reconciled; **Account/device gate** = actual account/hardware evidence is missing. No label alone constitutes final closure.

| ID | User requirement / reported issue | Baseline | Batch |
| --- | --- | --- | --- |
| S01 | Integrated four-app suite, LiveIt primary, visible access to other apps | Shipped, scope checked | B6 |
| S02 | Shared appearance, terminology, dark mode and improved Personal colours/contrast | Partial | B6 |
| S03 | Efficient workspace, hideable sidebars, usable phone/iPad mini layouts | Partial | B6 |
| S04 | Overlapping text/buttons, Focus Tasks overflow, stuck mobile views, menus close outside/Escape | Shipped fixes; full review due | B4/B6 |
| S05 | Offline usefulness, local copies and no subscriptions | Partial; preserve constraint | B1/B3/B6 |
| K01 | Slow/flickering OneDrive connection, login loops, disconnects and folder selection failure | Shipped fixes; account gate | B1 |
| K02 | Slow or failed saves and freezing after reopen | Partial; actual repository timing open | B1 |
| K03 | Mac save and iPhone resume using current data | Account/device gate | B1 |
| K04 | Actual KeepIt repository, dedicated app folders, browse within apps, avoid gallery clutter | Shipped app-file workflows; coverage audit due | B1 |
| K05 | Editable diagrams, LiveIt work, trips, destinations and offline map files preserved in repository | Exists, coverage audit due | B1/B3/B5 |
| K06 | Shared notes, documents, photographs and offline access to required originals | Partial | B1/B3 |
| K07 | OneDrive Personal initially, optional Business/Google, local-only option | Personal/local paths exist; remaining provider scope audit due | B1/B6 |
| L01 | Multi-day events that persist beyond one device | Implemented; account/device gate | B1/B4 |
| L02 | Correct Work/Personal calendar visibility and repair reported iPhone calendar sync | Account/device gate; calendar implementation exists | B1/B4 |
| L03 | Scheduled TravelIt trips automatically reflected in LiveIt | Synthetic checks pass; account/device gate | B1/B4 |
| L04 | Notes/events associate with KeepIt files | Exists, complete workflow audit due | B1/B4 |
| L05 | Work task views split into Projects and Operations | Exists in live source; verify/refine | B4 |
| L06 | Quick capture, tasks, reminders, look-ahead and anniversaries | Exists, complete behaviour/scope audit due | B4 |
| T01 | Mind Map, Flowchart, Org Chart, Bubble Diagram and Outline/WBS | Exists, feature reconciliation due | B5 |
| T02 | Collapsible/expandable phases and subprocess substeps | Integrated hierarchy; real-project review due | B5 |
| T03 | Rearrange topics in Outline and ideally Mind Map | Partial | B5 |
| T04 | Improved colour/background contrast | Partial review | B5/B6 |
| T05 | Selectable print-accurate horizontal/vertical rulers, layout measurements, fit-to-page | Browser checks pass; physical calibration open | B5 |
| T06 | BMC words, pictures, tables, notes and rich text | Local reopen and portable backup restoration checked; broader editing review due | B5 |
| T07 | Long notes saved through KeepIt, useful offline | Exists, complete workflow audit due | B1/B5 |
| R01 | Slow startup, disappearing map and stuck mobile view | Startup/foreground fixes checked; broader cases open | B3/B6 |
| R02 | Map fills workspace, full-screen toggle and clear exit | Browser checks pass; physical-device review due | B3/B6 |
| R03 | Easy offline map download, loading and reopening | Exists, complete region/device workflow audit due | B3 |
| R04 | Excel as primary input, saved trip import rather than preview only | Synthetic saved import checked; content-coverage audit due | B2 |
| R05 | Simple Places with coordinates; retain budget, bookings, decisions and other useful workbook content | Partial reconciliation | B2/B3 |
| R06 | Larger imported text and readable responsive whole-trip Gantt | Shipped improvements; actual-workbook review due | B2 |
| R07 | Calendar highlights, clear dates and correct weekday alignment | Exists, complete audit due | B2 |
| R08 | Rearrange sequence in Outline and ideally Mind Map | Flexible up/down ordering exists; complete workflow open | B2 |
| R09 | FS/SS/FF/SF dependencies with calculated timing | Types exist; dependent activities still require manual start time | B2 |
| R10 | Packing by activity/environment and clearer multi-item entry | Templates exist; entry usability/reconciliation open | B3 |
| R11 | Improved budgeting, preserve useful budget information through Excel workflow | Partial | B2/B3 |
| R12 | Delete trips, remove Cagayan samples, clean start and keep itinerary rows out of Explore | Exists, complete behaviour audit due | B2 |
| R13 | KeepIt trip notes and travel documents: passports, itineraries, bookings, brochures/guides, offline access | Links exist; original-file/offline workflow open | B1/B3 |
| R14 | Route planning, Waze/pins, stays, photos/memories and Quick Day View | Original scope; complete implementation reconciliation due | B3 |

## Concrete work within batches

### B1 — finish the data foundation

1. Trace one current workspace/project, calendar event and linked original through actual app capture, dedicated repository location, local copy, cloud readback and reopen. Use the actual existing repository path; preserve existing data.
2. Reuse existing passing auth/write/recovery checks. Investigate only specific remaining failures or missing paths, including library-scale connect/save timing and reopen freezes.
3. Reconcile attachment/original-photo storage, references, downloaded copies and migration from older local records. Implement gaps without silently replacing originals with previews or losing existing content.
4. Keep local save, pending sync, verified sync, conflict and unavailable states understandable. Prevent stale overwrite, duplicate calendar publication and accidental resurrection after deletion.
5. At account access: one focused Mac-to-iPhone-to-Mac save/edit/reopen flow covering app data, a multi-day event/trip calendar projection and a linked file. Engineering owns preparation and diagnosis; do not hand the owner a broad QA checklist.

### B2 — finish trip planning as a complete workflow

1. Check a representative existing itinerary workbook against imported/saved content, including Places/coordinates, costs, bookings and decisions. Preserve useful information even where a sheet is simplified.
2. Complete missing saved import coverage and readable itinerary/Gantt/calendar representations. Verify overnight activities, blank days, fixed bookings, dates and weekdays.
3. Derive dependent timing from a timed anchor and duration/relationship/lag instead of requiring an arbitrary manual start for every dependent item. Handle cycles, missing anchors and trip-date limits explicitly. Protect fixed bookings and make proposed schedule changes reviewable.
4. Finish ordering through the requested Outline/Mind Map interactions while preserving item identity, details, references and dependency relationships. Separate presentation order from fixed appointment times.
5. Complete deletion and sample-data separation. Verify deletion propagation and recovery behaviour, destination reuse and retained shared originals. Do not delete existing owner content as part of sample cleanup.

### B3 — finish using the trip

1. Improve packing entry, activity/environment template combinations, deduplication and packed-state persistence.
2. Reconcile requested budgeting against current costs features and workbook inputs. Complete missing preservation/calculation/editing; retain planned versus actual values and clear unknowns.
3. Verify bounded offline-map download/import, selection, reopen, viewport/full-screen behaviour and recovery. Establish usable region/device limits; do not imply offline navigation when only reference maps are available.
4. Complete trip-linked original documents and photographs, explicit offline availability and recoverable missing references. A cached app workspace alone does not prove its linked files are downloaded.
5. Reconcile original route, Waze, stay, Quick Day View and travel-memory requirements into concrete completed behaviours. Keep destinations in Explore and trip scheduling in Trips.

### B4 — finish LiveIt daily use

Verify and refine existing Projects/Operations classification, capture and filters; due-date task groups; reminders/look-ahead and yearly events; multi-day calendar visibility; Work/Personal distinction; trip projection and file associations. Trace actual UI actions through reopen and sync rather than infer completion from code strings. Clarify any platform limitation against the original request before declaring closure.

### B5 — finish ThinkIt authoring

Use a realistic project spanning the requested modes, hierarchy and ordering, long KeepIt notes and BMC content. Finish authoring gaps, reference preservation and portable restoration. Check contrast and desktop/tablet/phone controls. Verify print dimensions/rulers, paper/margins and fit-to-page output; retain the existing BMC/ruler evidence and keep the physical calibration gate separate.

### B6 — complete the suite

Review appearance/language, discoverability, sidebars, touch targets, dropdowns, header overlap, mobile stuck states and startup/reopen behaviour across all four apps. Review optional Business/Google provider requirements after the Personal/local data path; implement or identify their exact remaining gaps rather than imply all providers are supported. Complete the final requirement/evidence reconciliation on one current published release.

## Working rules and closure

- Maintain this register and the existing technical evidence ledger together when each implementation batch ships. Use stable requirement IDs in change descriptions and progress reports.
- For each item, record remaining implementation, appropriate evidence, published commit/release and any account/hardware gate. Distinguish browser/device simulation from physical-device results.
- Use existing passing checks as the baseline. Run meaningful checks for changed behaviour and required release gates; do not repeatedly broaden testing without a new failure, change or unresolved concern.
- Publish complete workflow batches. Do not produce cosmetic-only releases while higher-priority functional work is available, unless the cosmetic defect blocks use.
- Report concrete outcomes: requirement IDs actually closed, implemented work with a remaining acceptance gate, remaining gaps and the next batch. Do not report invented percentages or use 'implemented' as a substitute for completed user behaviour.
- Request owner input only for actual account/device access, physical print calibration, or a concrete unresolved product choice. Reuse existing preferences and authorizations; do not repeatedly ask permission to continue.

## Immediate next implementation pass

Start with B1's per-app object/original-file trace and actual repository coverage. Record only concrete gaps. Keep the owner-account Mac/iPhone gate open while unavailable. The first independently identified B2 coding gap is dependency-derived timing without a manually entered dependent start time; follow with complete Excel content preservation and requested ordering. Projects/Operations is a verification/refinement task because its implementation already exists.
