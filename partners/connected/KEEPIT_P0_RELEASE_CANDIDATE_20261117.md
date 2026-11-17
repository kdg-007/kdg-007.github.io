# KeepIt connected suite — P0 release candidate ledger (17 Nov 2026)

This document is source and QA evidence only. It does not authorize production deployment, real-account writes, or mutation of an existing owner library.

## Candidate and tests

- Source branch: `fix/keepit-transport-error-classification-20261114`
- Microsoft Graph and preauthenticated OneDrive transfer classification: compiled into new, fingerprinted code so an installed PWA does not reuse a stale cached validator.
- CSP and signed-transfer hostname validator now agree for approved Microsoft storage host families, with no generic wildcard web access.
- TravelIt fast startup bundle rebuilt with pinned esbuild 0.28.2 from checked-in `app.js`, with byte-identical second build and owner-release asset proof.
- Restricted compiler workflow: [run 44061119179](https://github.com/kdg-007/kdg-007.github.io/actions/runs/44061119179) PASS. Artifact commit `a2772ca543b194c82419f495288b8848a67d9da9`.
- Prior integrated suite on a different SHA is not evidence of acceptance for this precise candidate. A fresh full-suite run must pass the final branch SHA.

## Known prior owner requirements, in order

**P0 — launch and cloud:** existing KeepIt library preserved; reliable login/retry and nested folder access; correct offline/local/pending/cloud states; no login loops; durable Microsoft Graph catalog and original readback; native note save with independent cloud receipt; iPhone/Mac synchronization; non-destructive conflict/restart recovery; safe installed-app update/rollback.

**P1 — everyday suite:** predictable LiveIt Work/Personal calendar and multi-day events; stable ThinkIt hierarchy, print rulers/contrast/BMC; TravelIt records, maps/fullscreen, Gantt, Excel imports, budgets and packing; KeepIt linked notes, original bytes and recovery; mobile layouts without overlapping controls.

**P2 — deferred feature:** SW1–SW4 ThinkIt swimlanes from draft PRs #20–#23 and the 17 Nov handover ZIP. Existing H5 and source ownership are to be reconciled; do not import unrelated experimental code into the P0 branch.

## Explicit HOLD

Synthetic Microsoft and browser fixtures cannot demonstrate an authenticated physical iPhone or Mac readback. Before a claim of reliability:
1. QA all green for exact code and cache/proof hashes.
2. Owner-approved disposable authenticated read-only catalog listing and file original readback in the existing selected OneDrive Personal library.
3. Only after read path verified: approved new test note, cloud receipt and independent reload on another device; test offline/restart reconciliation without loss/duplicates.
4. Controlled production deploy and rollback verification after approval.

Do not disconnect the owner's account, reinstall, use a replacement library, auto-migrate app data or replay ambiguous writes to make the tests appear green.

## Transport error action and final rebuild checkpoint

- The first full QA attempt on the unrebuilt source change (`bff6e740`) correctly refused mismatched pinned JavaScript. This was a provenance gate, not a runtime regression.
- Branch-only compiler run `44063406523` succeeded and committed new fingerprinted connection and entry assets (post-build head `ac7cf09e`).
- Error state now says **Select the OneDrive status to retry** for recoverable Graph transport failures, and **Reconnect Microsoft** for expired/revoked authentication; no local edit deletion.
- The release test still asserts a visible actionable retry instruction and then performs a successful retry. A new full QA run must target the compiled-asset commit or its descendants, not the precompiler SHA.
