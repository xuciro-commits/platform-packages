# Changelog

## 0.1.0

- 通话记录 `phone.call`：来电与外呼，振铃、通话、完成、未接、失败；对上往来单位的联系人；坐席、主管与语音网关三个角色；仪表盘。
- 实现能力 `call/1`：`dial` 新建一条外呼记录。需要平台带 `createTransaction` 与 `me()` 编译的 `pkg`。
