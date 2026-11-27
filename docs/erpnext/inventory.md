# ERPNext v16 源码普查

基线：8e10a348daaa93853de8c36dc55ec789a440c219。Git 跟踪文件 5667；modules.txt 声明 21 个模块；解析到 534 个 DocType 元数据。统计不等于逐行审阅。

| 模块 | 路径前缀（erpnext/） | 文件 | DocType | 报表定义 | Python 测试文件 | 研究状态 |
|---|---|---:|---:|---:|---:|---|
| Accounts | accounts | 1418 | 191 | 56 | 157 | indexed |
| CRM | crm | 198 | 28 | 9 | 23 | indexed |
| Buying | buying | 217 | 20 | 10 | 21 | indexed |
| Projects | projects | 143 | 15 | 5 | 15 | indexed |
| Selling | selling | 312 | 20 | 23 | 38 | indexed |
| Setup | setup | 268 | 40 | 0 | 28 | indexed |
| Manufacturing | manufacturing | 395 | 50 | 21 | 44 | indexed |
| Stock | stock | 761 | 76 | 52 | 105 | indexed |
| Support | support | 90 | 11 | 4 | 10 | indexed |
| Utilities | utilities | 43 | 4 | 1 | 5 | indexed |
| Assets | assets | 152 | 26 | 3 | 17 | indexed |
| Portal | portal | 10 | 2 | 0 | 0 | indexed |
| Maintenance | maintenance | 30 | 5 | 1 | 2 | indexed |
| Regional | regional | 87 | 5 | 4 | 11 | indexed |
| ERPNext Integrations | erpnext_integrations | 9 | 1 | 0 | 1 | indexed |
| Quality Management | quality_management | 90 | 16 | 1 | 10 | indexed |
| Communication | communication | 9 | 2 | 0 | 1 | indexed |
| Telephony | telephony | 25 | 5 | 0 | 4 | indexed |
| Bulk Transaction | bulk_transaction | 12 | 2 | 0 | 2 | indexed |
| Subcontracting | subcontracting | 78 | 13 | 3 | 7 | indexed |
| EDI | edi | 17 | 2 | 0 | 3 | indexed |
| 其他及跨模块 | repository / controllers / patches / public 等 | 1303 | 0 | 0 | 41 | indexed |

## 可核查索引

- source-index.tsv：全部 Git 跟踪文件的路径、固定提交和研究状态。
- doctype-index.tsv：仅元数据身份与子表/单例标记，不搬字段定义。
- module-edges.tsv：Link / Table / Table MultiSelect 字段跨模块引用次数，方向是引用方 → 被引用方。未在 ERPNext 元数据内解析的目标记 external-or-unresolved；不代表依赖 Frappe 的全部关系。
- 这些是源码目录和静态元数据普查，不代表调用图、事务边界、业务审阅或完成度。Python 动态调用、hooks、控制器、前端与补丁在每一波单独审阅；不以引用次数决定包依赖。
- 每一模块完成后更新研究状态、设计稿与验收证据。基线变化时单独比较新增/删除文件，不能覆盖已核验记录。
