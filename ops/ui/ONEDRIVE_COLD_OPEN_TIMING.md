# OneDrive cold-opening performance and timing

The initial opening of an existing cloud library previously read the original
folder catalog through the sequential directory adapter. Later verification
already used bounded read-ahead, which left the first-device path unoptimized.
Cold opening now uses the same maximum of four overlapping small catalog reads.
Large snapshots retain the existing processing budgets and serial fallback.

The canonical catalog validator still verifies every checksum, revision link,
original path and complete history chain. Fresh checks before conditional writes,
readback, checkpoint identity and draft recovery are unchanged. A checkpoint
reopen still checks the live pointer and legacy signature before reuse.

The OneDrive dialog contains **Connection details** and **Download connection
report**. Reports contain attempt-local phase durations, operation counts,
overlap peaks, numeric HTTP status counts and total bytes read. Phase wall time
and summed operation time differ when requests overlap. Download operation time
covers response delivery; the file-read aggregate includes full body reading.
The report includes no account identifiers, folder/file names, URLs, tokens,
document contents or raw errors. It stays on the device until downloaded.

Automated acceptance opens a nested existing library on a 393px phone layout
with twelve original catalog revisions in Chromium and WebKit. It checks bounded
overlap, exact download count, report contents, checkpoint reopen and read-only
failure on a deliberately corrupt legacy checksum. Existing save/reopen,
reauthentication and cross-device tests remain release gates.

This optimization does not establish actual iPhone or owner-account performance.
The remaining acceptance is a measured existing-library open and original-file
read on the owner's iPhone, followed by Mac–iPhone–Mac edit/readback continuity.
