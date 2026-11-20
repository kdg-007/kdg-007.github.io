# Kept originals and linked documents — 20 November 2026

An explicit **Keep offline on this device** action now retains a verified original in this browser's IndexedDB cache. Notes, file previews, external attachment previews, LiveIt links and TravelIt documents expose availability and device-copy removal. Native notes include their embedded photos; separate linked originals must each be kept.

Kept copies survive the app's automatic LRU eviction. The shared budget remains 256 MiB, 64 MiB per original and 512 entries. A full budget fails atomically and retains existing kept files. Removal affects this device's cache, never the OneDrive original, catalog, pending edits or another library. Browser storage persistence is requested on explicit keeping; the OS/browser can still clear site data.

WebKit-compatible byte buffers are stored in IndexedDB and reconstructed as Blobs on read; older Blob rows remain readable. Every read validates bytes and digest. Cache keys include account, drive, root, library, path, item ID, digest and size. When a current original changes, the UI identifies an older kept version and offers an update. An older digest is never substituted for the current catalog original. Updating a kept copy replaces its previous version atomically after validation and budget checks.

A cached OneDrive gallery can open verified ordinary originals as well as native notes. Cloud file metadata remains read-only during an outage. Local-library authoring and the existing native-note draft/outbox behavior are unchanged. PDF originals use the browser's built-in viewer while offline; independent Download remains available for formats needing another app.

## Validation

45 focused Node checks cover cache planning, connection recovery, catalog reads and device-copy continuity. CI additionally exercises actual IndexedDB in Chromium/WebKit and linked-note/file keeping, provider-outage restart, offline opening, local removal and TravelIt document controls, alongside the existing suite regressions.

## Remaining acceptance

No bulk trip/document download, recursive linked-file collection, above-budget file support or operating-system storage guarantee is claimed. Actual iPhone cold-start latency, installed-app airplane-mode restart and the owner's Mac-to-iPhone-to-Mac roundtrip remain physical-device acceptance gates. Automation uses synthetic provider fixtures and contains no owner's file content.
