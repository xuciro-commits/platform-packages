# 分类与标签

每个包在 `package.yaml` 里声明分类。它们进市场目录（`catalog.json`）供筛选与搜索，不进运行时制品。

| 字段 | 取值 | 例子 |
|---|---|---|
| `industries` | 行业，可多选；通用的写 `general` | `general`、`manufacturing`、`hospitality`、`healthcare`、`education`、`finance`、`retail` |
| `capabilities` | 业务能力，可多选 | `sales`、`service`、`hr`、`accounting`、`inventory`、`purchasing`、`production`、`projects`、`assets`、`quality`、`learning`、`knowledge` |
| `keywords` | 自由关键词，小写，最多 10 个 | `lead`、`pipeline`、`payroll` |
| `stage` | `stable`、`preview`、`test` | 测试与示例包写 `test`，市场默认不列出 |
| `source` | 来源应用：生态、应用、版本、许可，与关系 | `{ecosystem: frappe, app: crm, version: v1.x, license: AGPL-3.0, relation: redesign}` |

- `relation` 只有两种：`redesign`（读懂业务后按平台语义重新设计，不含来源的定义与代码）与 `derived`（由来源定义转换而来，沿用来源许可，不进本仓库）。
- 能力与行业的取值由本表维护；要加新值，在同一个 PR 里改这张表。
