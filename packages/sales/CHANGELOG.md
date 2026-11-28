## 0.2.1

- Connected `sales.delivery` (`SALES_COGS`) and `sales.invoice` (`SALES_REVENUE`) optionally to `gl.post/1`.

## 0.2.0

- Implement `customer` (extending `party.organization`), `customergroup`, `territory`, `order` + `orderline`, `delivery` + `deliveryline`, `costentry`, and `invoice` + `invoiceline` with line paste, validation, and A4 print layouts.
- Wire `order.confirm` to `stock.reserve/1` with `reservereply` shortage feedback and `delivery.post` to `stock.post/1` + `stock.reserve/1#release` echoing `4.5` outbound cost into `sales.costentry`.
- Preserve full degradation when `inventory` is retired and full downstream provenance on `sales.order`.

## 0.1.0

- Initial navigation candidate for ERPNext Selling.
