# 分类与标签

每个包在 `package.yaml` 的 `listing` 下声明分类。它们进市场目录（`catalog.json`）供筛选与搜索，不进运行时制品，改分类不改制品的摘要。
`pkg check` 与平台读目录时都校验下表；取值写在平台的 `pkg` 里，要加新值先给平台提改动。

| 字段 | 取值 |
|---|---|
| `industries` | 行业，最多 8 个：`general`（通用）、`manufacturing`、`retail`、`distribution`、`hospitality`、`healthcare`、`education`、`finance`、`professional-services`、`construction`、`real-estate`、`energy`、`logistics`、`agriculture`、`nonprofit`、`public-sector` |
| `capabilities` | 业务能力，最多 8 个：`sales`、`marketing`、`service`、`hr`、`payroll`、`accounting`、`inventory`、`purchasing`、`production`、`projects`、`assets`、`maintenance`、`quality`、`learning`、`knowledge`、`lending`、`operations` |
| `keywords` | 自由关键词，最多 10 个，小写、无空格、不超过 32 个字符；进市场搜索 |
| `stage` | `stable`、`preview`、`test`；市场默认不列 `test` |
| `source` | `ecosystem`、`app`、`relation` 必填，`version`、`license` 可选 |

```yaml
listing:
  industries: [general]
  capabilities: [sales]
  keywords: [lead, deal, pipeline]
  stage: preview
  source: {ecosystem: frappe, app: crm, version: v1.x, license: AGPL-3.0, relation: redesign}
```

- `relation`：`redesign`（读懂业务后按平台语义重新设计，不含来源的定义、代码与文案，以 Apache-2.0 发布）；
  `derived`（由来源定义转换而来，只收 MIT、Apache 等宽松许可的来源，保留其版权声明）；`original`（没有来源）。规则见 [来源应用](sources.md)。
- 生成目录：`node scripts/packages.mjs catalog`（调用 `pkg catalog`，地址模板见 [发版](release.md)）。
