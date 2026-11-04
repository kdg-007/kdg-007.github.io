# KeepIt — compiled device-QA hosting

**QA status: DEPLOYED (November 4, 2026); current live-site identity check pending.**
This repository serves the **compiled, isolated QA-only KeepIt app** at
https://kdg-007.github.io/.

| Release control | Verified value |
| --- | --- |
| Live compiled build ID | `8566963692f1` |
| Compiled transfer SHA-256 | `ba8022f9c5f1844f7700dd40683a93160c2663964f7ee6f9070421b7f293bfa8` |
| Original private-build CI | [41773987899](https://github.com/kdg-007/keepit-build-private/actions/runs/41773987899) — passed |
| Public guarded publisher | [41775023374](https://github.com/kdg-007/kdg-007.github.io/actions/runs/41775023374) — passed |
| GitHub Pages build/deployment | [41775040558](https://github.com/kdg-007/kdg-007.github.io/actions/runs/41775040558) — passed |
| Independent live-site verification | Previous release passed; new release pending independent check |
| Protected disposable OneDrive folder | `KeepIt-TK02-QA-2026-10-30` |

The previous release's live check validated the public `build-info.json`, matching `sw.js`,
the current compiled application entrypoint, Microsoft authentication callback,
QA site security policy and the guarded upload/recovery actions.

## Verified scope

The private build's synthetic automated regressions cover 71.4 MiB original
recovery, zero-byte orphan protection, uncertain OneDrive receipts, interrupted
upload sessions, source integrity and durable queue cleanup. Chromium and
Playwright WebKit exercised the compiled app's local file imports, exact-byte
readback, note draft recovery, actual native note creation/save/edit/History and
three-cycle WebKit offline reloads. WebKit-specific IndexedDB binary
serialization problems were corrected in the queue, device library and
native-note workspace.

**New in build 8566963692f1:** ZIP format `keepit-device-backup-5` now preserves earlier native-note revisions alongside the current note, with verified original bytes and metadata. Older backups remain readable. Repeated restores do not duplicate history; damaged archives are rejected; conflicting identities are preserved. Five new end-to-end regressions and the existing browser and large-file recovery tests passed.

**QA deployed does not mean production accepted.** Actual iPhone Safari and Mac
use, Microsoft account sign-in, remote OneDrive readback under live network
conditions, mobile background suspension and large-file memory pressure remain
unverified by device acceptance. Playwright WebKit on Linux is not physical
iPhone Safari. The site may be accessible publicly: never add production documents
or private data to disposable QA testing.

## Release and security controls

- The pinned source archive and source patches remain in the **private** repository
  `kdg-007/keepit-build-private`, not this public repository.
- The private CI publishes a compiled-only base64 transfer to a private
  `delivery/` directory after all tests pass.
- The public `delivery/` folder contains only verified compiled ZIP transfer
  parts and the attestation manifest; it contains no private source ZIP.
- `.github/workflows/keepit-pages.yml` verifies transfer digest, archive paths,
  build policy and QA-only OneDrive folder before publishing `_site` contents
  to the configured branch-backed GitHub Pages host.
- `.github/workflows/diagnose-keepit-pages.yml` validates the deployed
  version dynamically against the latest transfer manifest.
- Live application data is not hosted by GitHub Pages. Production OneDrive
  folders, user documents, tokens and Microsoft secrets must never be committed.

### Remaining acceptance

Carry out controlled, disposable QA-folder sign-in, file save/reopen/readback,
restart and Mac/iPhone compatibility checks before any production-library
migration or broader SIMA integration. A production deployment requires an
independent safety and data-integrity release decision.
