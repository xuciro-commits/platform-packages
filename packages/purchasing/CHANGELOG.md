## 0.2.3

- Connected `purchasing.receipt` optionally to `gl.post/1` (`PURCHASE_RECEIPT`) with closed-period refusal feedback.

## 0.2.2

- Align `stock-contract` dependency to `^0.1.2`.

# Changelog

## 0.2.4

- Provided `supply.order/1#orders` on `purchasing.orderline` (tracking open unreceived approved quantities) and `supply.requisition/1#submit` on `purchasing.requisition` with source provenance.

## 0.2.1

- 采购收货过账向库存契约传递明细行入库金额。

## 0.2.0

- 新增多行单据 `purchasing.receipt` / `purchasing.receiptline` 与打印配置，经可选契约 `stock.post/1` 向库存过账与冲正；未安装或停用库存时独立记录采购事实。

## 0.1.0

- 初始候选切片。
