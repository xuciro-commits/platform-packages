# Changelog

## 0.2.0

- Upgraded `accounting.journalline` to an immutable `ledger: true` fact table with `closedBeforeRecord` bound to `accounting.book/DEFAULT`, signed `net` measure, and `trial_balance` / `account_summary` period summary reports with cell-to-fact-to-document drilldown.
- Implemented `gl.post/1` provider on `accounting.journal` with `inFlight` read-only projection (`accounting.journal.inflight`) and customer-editable `accounting.postingrule` records (`PURCHASE_RECEIPT`, `SALES_COGS`, `SALES_REVENUE`, `INVENTORY_GAIN`, `INVENTORY_LOSS`, `PRODUCTION_ISSUE`, `PRODUCTION_RECEIPT`).
- Added live subledger inventory vs. GL inventory account reconciliation on `accounting.book` with itemized undelivered voucher drilldown and polymorphic `sourceid` links.
- Added `accounting.period.closeperiod` enforcing 3 explicit guards (no draft journals in period, zero subledger reconciliation difference / zero in-flight vouchers, balanced trial balance) and advancing both `accounting.book/DEFAULT.closedbefore` and optional `stock.close/1#close`.

## 0.1.0

- Initial chart of accounts and journal draft candidate.
