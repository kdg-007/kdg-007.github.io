# Shared Application Interface v1

**Owner model:** LiveIt is the primary home/dashboard. KeepIt is the authoritative notes/files repository. ThinkIt is diagramming, TravelIt is travel planning, and PlanIt will be integrated after its own release gate.

This is a **presentation-only harmonization** of existing first-party preview apps, not a new umbrella application or a change to note ownership, app navigation, browser origins, OneDrive, IndexedDB, localStorage, or records.

## Shared design contract

| Element | Light | Dark |
|---|---|---|
| App background | `#F7F7F3` | `#10212D` |
| Primary surface | `#FFFFFF` | `#1C3444` |
| Chrome/navy | `#102D40` | `#162C3B` |
| Primary accent | `#0D7475` | `#72D2C5` |
| Main text | `#19384A` | `#E7F0F2` |
| Muted text | `#5D7380` | `#B3C6CE` |
| Divider | `#D7E2E5` | `#3B5562` |
| Personal-specific secondary | Muted lilac `#7665A7` | Muted lilac `#C5B5EE` |

- System font stack throughout; do not download fonts or introduce subscription dependencies.
- Radii: 8 px small, 12 px controls, 16 px cards/dialogs. Rhythm: 4/8/12/16/24/32 px.
- Visible focus outlines, no low-contrast text, 44 px preferred finger targets on touch UI.
- Controls use the same semantic intent: filled primary action, bordered secondary, ghost utility, clearly distinct destructive action.
- Navigation vocabulary is shared: Apps, Today, Library, Projects, Operations, Settings, Save, Back, Search.
- The independent app-specific workspace remains: ThinkIt canvas/ribbon and printing; TravelIt maps/trip itinerary; KeepIt reader and file metadata; LiveIt Today/Focus.
- Collapsible navigation/sidebars and focus mode are suite-level **behavioral targets**, not supplied merely by CSS; do not claim controls exist where they have not been implemented.
- Respect the user's current per-app appearance preference; **do not overwrite app storage** to force cross-app dark mode. Shared preference synchronization needs a separate reviewed task.
- Distinguish data saved **locally** from **OneDrive synchronized**. Visual harmonization never upgrades storage acceptance.

## Scope and testing

Shared CSS: `/partners/design/app-family-v1.css`. The active connected previews consume this file as an additive final stylesheet. No original JavaScript/CSS runtime assets are modified.

LiveIt W18E and connected LiveIt retain original scripts and saved data. TravelIt and ThinkIt retain their app-specific information architecture and existing JS. Connected KeepIt loads styles from the existing nav CSS while its compiled native writer and QA OneDrive guards remain unchanged.

**Pass gate:** all four app entrypoints load; CSS tokens resolve to the agreed palette; dark/light states remain legible; LiveIt Work/Personal and Projects/Operations still function; launchers remain visible; ThinkIt diagrams, TravelIt trips and native KeepIt save/reopen regression remains green. Validate iPhone and Mac visually before calling the suite design accepted.

**Not included:** PlanIt implementation, automatic data migration, OneDrive production access, single sign-on, global theme-persistence service, or cross-origin storage migration.
