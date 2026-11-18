# KeepIt Mac catalog readback — P0 acceptance ledger

Observed on MacBook, 18 Nov 2026: existing `OneDrive / 06 Database / 05 Knowledge Base / KeepIt` and its `_Catalog`, `Files`, `LiveIt`, `ThinkIt`, `TravelIt` folders list, but selection reports `Cannot read properties of null (reading 'size')`. Mac connection slow. iPhone displays the existing populated library.

Source candidate is read-only null-cache fallback (one uncached GET after a null cached read), explicit catalog-file and history-file guards, and a safe `KI-OD-CATALOG-NULL` stage diagnostic. No OneDrive data mutation, account disconnection, folder replacement or sync schema modification.

Branch-only pinned compile and targeted null-readback checks passed [run 44196113556](https://github.com/kdg-007/kdg-007.github.io/actions/runs/44196113556). This document triggers a full connected browser regression against the final generated assets, not the precompiler source commit.

**Not yet accepted:** actual physical Mac authorization and verified original-file readback in the existing folder; unrelated cloud write and real Mac/iPhone save/reopen. Keep this PR draft until regression is green and a controlled rollout can be tested without deleting or remounting the library.
