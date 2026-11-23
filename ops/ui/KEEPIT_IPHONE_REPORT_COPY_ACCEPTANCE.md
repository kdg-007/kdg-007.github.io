# iPhone OneDrive connection-report sharing (2026-11-23)

## Motivation
The owner confirmed OneDrive connection on MacBook but reports high or unpredictable connection latency on iPhone. The existing privacy-filtered connection diagnostics are downloadable JSON, which is awkward to retrieve and attach on iOS Safari.

## Scope
- **Copy connection report** appears in OneDrive → Connection details after a connection attempt.
- The clipboard receives the **same structured JSON** as Download connection report; it contains only fixed timing phases, counts, HTTP status totals and bytes, with no accounts, paths, URLs, signed tokens, names or original-file contents.
- If WebKit/Safari does not permit clipboard access, provide a focused read-only field with selectable JSON for manual copy.
- No account reauthorization, cloud writes, data migration, connection timing changes or library selection changes.

## Required acceptance
1. Reproduce the existing owner nested-library connection on a 393px phone layout.
2. Verify clipboard success produces the same sanitized JSON as the downloaded report.
3. Force clipboard denial and verify manual-select fallback, no PII, and no visible fallback when copying succeeds.
4. Run unchanged connection recovery, CSP, native-note and connected-app browser checks.
5. Verify the generated content-addressed connection and entry bundles; preserve the original selected library.

Physical iPhone connection latency and Mac–iPhone–Mac roundtrip remain **unverified**. A copyable diagnostic is preparation for that measurement, not itself a speed fix.
