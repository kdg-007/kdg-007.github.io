# Suite user comments — completion ledger

Updated 2026-11-13. “Implemented” describes shipped code and checks; it does not certify the owner's physical devices or Microsoft account.

| User comment | Implementation / evidence | Still required |
| --- | --- | --- |
| OneDrive login loops, disconnects, folder choice | Bounded reads; explicit reconnect after rejected renewal; folder navigation rollback/retry; deployed synthetic sign-in checks | Owner-account stability over normal use |
| KeepIt slow connect/save | Catalog refreshes now share one in-flight verification; saves require a fresh preflight and readback; interrupted reads release for retry | Full-library timing on the owner's actual repository |
| KeepIt freezes after reopen / saves fail | Local recovery and connection safeguards retained | Reproduce any remaining freeze or failure; not closed |
| Work on Mac and resume on iPhone | Immutable repository revisions; stale-tab protection; offline work retained; LiveIt automatic workspace save/open; separate calendar sync | Actual Mac–iPhone round trip; reported iPhone calendar issue not closed |
| Multi-day events and Work/Personal calendar | Implemented; range/identity checks; calendar items kept separate from workspace restores | Owner-device verification |
| Crowded top bars / menus stay open / mobile stuck view | Compacted LiveIt header; removed TravelIt tablet padding; drawer closes on outside click/Escape; menus constrained to viewport; phone/tablet browser checks | Broader device/layout coverage |
| TravelIt map full screen | Native fullscreen plus embedded/mobile expansion fallback; visible Exit; Escape; offline map support; loaded street tiles retained in browser check | Physical iPhone/iPad verification |
| TravelIt map disappears / slow loading | Map resize handling exists; Excel preview remains loaded on demand | Remaining map-loss reproduction and startup profiling; not closed |
| TravelIt Excel input, text and Gantt | Imported a synthetic six-day, 48-activity workbook through the browser; whole-trip Gantt retains blank days, overnight labels, flexible activities and source codes; sticky activity titles and phone scrolling checked | Actual owner workbook and physical-device review |
| Packing by activity/environment, budgeting | Combined templates preserve existing entries; costs implementation exists | Full user workflow review; remaining requested improvements |
| Offline map download | Bounded regional download and attribution checks pass; offline expansion works | Region coverage and on-device download/reopen review |
| Delete trips, remove samples, destinations in Explore | Implementations exist | Final behavior audit against user comments |
| Trip sequence and travel documents / KeepIt links | Direct up/down controls reorder flexible activities; imported codes and order survive reopening; timed/fixed activities are protected. Dependencies and canonical KeepIt references pass domain checks | Full outline/mind-map rearranging and actual document-opening workflows |
| ThinkIt collapsible hierarchy | H5 integrated in the connected suite | Remaining real-project observations |
| ThinkIt contrast, horizontal/vertical print rulers, BMC rich text/images/tables/notes, outline reorder | Implementations exist in prior releases | Print accuracy and complete feature audit; not all closed |

No new decision gate is needed for these engineering fixes. Ask for the owner's input only for a concrete product choice or account/device access that cannot be verified here. Do not turn this ledger into another manual test checklist for the owner.
