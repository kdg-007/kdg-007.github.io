# TravelIt budget: assessment and implementation boundaries

The budget should answer: what do we expect to spend, what have we recorded spending, what is still unknown, and which items are over plan? It should work for a family trip without requiring each activity to have a cost.

## Working input delivered in this release

An editable table inside the Budget tab accepts multiple costs at once: category, description, optional trip date, planned PHP, actual PHP and notes. Validate the entire table and save as one guarded transaction. Keep incomplete drafts when changing views, and reject stale saves rather than overwriting another tab's edits. Existing detailed expense editing remains available.

Show saved planned and actual amounts, category totals and variance only for items with both values. Blank means unknown/unrecorded; it must not mean zero, paid, or settled. New draft values do not affect saved totals until Save budget succeeds.

Driving fuel/toll estimates remain separately disclosed references. The itemized expense total must not automatically add them again. A fuel allowance entered as an expense and a driving estimate can refer to the same cost. Current fuel reserve applies only to fuel and is not a whole-trip contingency. Amounts remain local; no payments or bookings are initiated.

## Next useful budget model

| Capability | User benefit | Required implementation |
|---|---|---|
| Quantity × rate | Enter meals per person/day and rooms per night quickly | Store quantity, unit, rate, adults/children and basis; preserve through edits, backup and restore |
| Budget ceiling and contingency | See remaining allowance and a whole-trip reserve | Separate base budget, reserve and actuals; never label an unentered ceiling as zero |
| Cost status | Distinguish quotation, confirmed amount, deposit and final payment | Separate payment transactions from planned/actual expense values; deposits must not add to cost twice |
| Shared costs | Track who paid and reimbursement balances | Household/participant IDs, allocations and settlements without double counting |
| Driving calculation mode | Choose manual fuel/tolls or calculated estimates | Explicit per-trip basis, reconciliation preview and a compatibility barrier for older clients |
| Excel budget import | Reuse the workbook without typing all costs | Import direct lines and assumptions; exclude subtotals; reconcile source precision and contingency; leave actuals unset |
| Day/category allocation | Understand hotel/food/activity spending | Allocate shared costs without multiplying a hotel stay or aggregate trip distance across activities |
| Forecast final spend | Combine actual spending and remaining estimates | Match comparable items, surface missing estimates, avoid treating unknown actuals as refunds or unused money |
| Currency support | Use foreign travel costs without losing original amounts | Store original currency/rate/date and PHP reporting amount; never silently update rates |
| Portable output | Review with family and retain a record | Export/print the same saved data and explicitly mark draft/unknown amounts |

The next data-model release should implement quantity/rate, ceiling/contingency and Excel reconciliation together, behind an additive schema/backup upgrade. Retain current flat expenses as valid legacy records, with unchanged amounts. Verify sum reconciliation, rounding, duplicate imports, edits, quota rollback, stale tabs, backup/restore and existing manual trips before publishing.
