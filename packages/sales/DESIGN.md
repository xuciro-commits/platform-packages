# Sales (`sales`)

## Opening Moment
A sales representative creates a Sales Order, pastes item lines, and clicks **Confirm order**: available stock (`onhand - reserved`) is reserved line-by-line across package authorities; if another rep claims the last units first, the losing order stays in **Pending confirmation** with the exact shortage quantity on screen.

## Clean-Room Source Grounding
- Redesigned from ERPNext v16 Selling (`Customer`, `Customer Group`, `Territory`, `Sales Order`, `Delivery Note`, `Sales Invoice`) and Stock (`Stock Reservation Entry`) under Apache-2.0 without copying GPL-3.0 code.
- Preserves the frozen 21-entry ERPNext Selling navigation in `applications/sales.yaml`.

## Six Primitives Mapping
1. **States**: Customer (`pending`, `active`, `hold`), Sales Order (`draft`, `confirming`, `confirmed`, `delivered`, `cancelled`), Delivery Note (`draft`, `posted`, `reversed`), Sales Invoice (`draft`, `posted`, `paid`, `cancelled`).
2. **Dictionaries**: `sales.customergroup`, `sales.territory`, shared `party.organization`, `item.master`, `uom.unit`.
3. **Actions & Contracts**: `order.confirm` -> `stock.reserve/1#reserve` (`reply: reservereply`); `delivery.post` -> `stock.post/1#post` (`reply: postreply` creating `sales.costentry` with exact `4.5` valuation) + `stock.reserve/1#release`; optional degradation when `inventory` is retired (`Inventory not connected`).
4. **Derived & Aggregates**: Order/Delivery/Invoice line totals, `orderline.deliveredqty` / `openqty` for downstream MRP, `delivery.totalcost` from `sales.costentry`.
5. **Roles**: `reader`, `rep`, `manager`, with `ask` confirmation on destructive `cancel`/`void` transitions.
6. **Provenance**: `sales.order` lists downstream Delivery Notes, Stock Movements (`refType`), Sales Costs, and Sales Invoices, each clickable.
