# Reviewed live connection and note modules

These readable modules preserve the released owner implementation from public
commit a87af0c10621aa233ca0ea8c30f52421f17e98bc, with the following scoped changes:

- Rebind an open note to a newly verified library object only when its complete
  account/drive/folder/library target is identical. Preserve the editor/session.
- Keep local saving and editing independent of cloud completion; retain pending
  drafts and reuse the existing conditional writer, conflict checks and original
  byte readback. Resume ordinary retained drafts as well as linked topic notes.
- A temporary Microsoft token-renewal timeout remains retryable. A rejected
  cached token forces refresh. Only GET requests receive a single immediate
  retry; writes stay under the durable outbox's reconciliation rules.
- Authentication failures are retried only after a verified same-target
  reconnection or renewed token, without resetting attempt counters.
- Network interruptions update connection feedback; background connection
  failures do not unexpectedly open the folder picker.

`node ops/ui/build-live-stability.mjs` requires esbuild 0.28.2 and produces new,
content-addressed assets. Original release assets remain available for rollback.
The build updates the owner entry and pins every transitive dependency. It does
not replace the immutable archived baseline or relax the provenance gate.

`partners/connected/save-connection-layout.browser.mjs` uses disposable notes
and synthetic OAuth/Graph services. No owner account or real documents are used.
