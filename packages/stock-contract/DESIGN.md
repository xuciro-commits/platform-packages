# stock-contract 设计

一句话定位：让采购、销售、生产等业务包通过统一契约 `stock.post/1` 向库存账本过账与冲正，未安装或停用库存时各自独立可用。

## 契约

- `stock.post/1#post`：按单据行幂等键写入物料、仓库、数量、业务日期与来源单据出处。
- `stock.post/1#reverse`：按同一单据行键调用账本系统冲正，保留原流水并标 `reversed: true`。
- 契约标题为 `Inventory`（中文“库存”），当未绑定或停用提供方时，宿主统一展示“库存未接入”。

## 许可

原创设计（`relation: original`），Apache-2.0。
