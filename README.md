# KeepIt — compiled device-QA hosting

**QA status: DEPLOYED AND LIVE-VERIFIED (November 4, 2026).**
This repository serves the **compiled, isolated QA-only KeepIt app** at
https://kdg-007.github.io/.

| Release control | Verified value |
| --- | --- |
| Live compiled build ID | `8c2bf6a81a3b` |
| Compiled transfer SHA-256 | `7b5a054e56a340b6217e78b81e9c7e528cb96ae13577ddb70ef5c43cd115ca90` |
| Original private-build CI | [41769322882](https://github.com/kdg-007/keepit-build-private/actions/runs/41769322882) — passed |
| Public guarded publisher | [41770331610](https://github.com/kdg-007/kdg-007.github.io/actions/runs/41770331610) — passed |
| GitHub Pages build/deployment | [41770346146](https://github.com/kdg-007/kdg-007.github.io/actions/runs/41770346146) — passed |
| Independent live-site verification | [41770613725](https://github.com/kdg-007/kdg-007.github.io/actions/runs/41770613725) — passed |
| Protected disposable OneDrive folder | `KeepIt-TK02-QA-2026-10-30` |

The live check validated the public `build-info.json`, matching `sw.js`,
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
