# Manufacturing Design

- `manufacturing.bom` and `manufacturing.bomline`: multi-level BOMs referencing `item.master` with component usage and scrap rate.
- `manufacturing.workorder`, `workorderline`, and `costentry`: material issue posts outbound stock movements and WIP vouchers; completion posts inbound finished-goods stock movements valued at the exact sum of issued component costs plus finished-goods GL vouchers.
- `manufacturing.mrprun`: executes `propagate` by low-level code over open sales demand + safety stock minus on-hand stock + open PO lines + open work orders, backward-scheduling start dates by item lead time and emitting idempotent draft `plannedworkorder` and `plannedrequisition` records with clickable provenance.
