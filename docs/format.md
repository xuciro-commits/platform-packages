# 源格式

一个包一个目录，全是手写的 YAML，一个资源一个文件。`pkg build` 把它打成运行时制品（一个 JSON，用来算摘要、签来源证明、挂到 Release；作者不打开它）。
YAML 是唯一的源：不要用脚本生成 YAML，也不要手改制品。

```text
packages/crm/
├── package.yaml              清单：标识、版本、分类、根资源
├── package.lock.json         生成，提交；不手改
├── README.md  CHANGELOG.md  LICENSE  DESIGN.md
├── objects/<对象>/
│   ├── object.yaml           字段、状态、视图、权限
│   ├── actions/<动词>.yaml   这个对象的一个动作：输入、条件、事务
│   └── page.yaml             可选：自定义页面；不写就按对象生成标准的列表加详情
├── applications/<应用>.yaml  菜单分组、仪表盘
├── flows/                    自动化与流程
├── integrations/matching/    匹配规则等集成
├── locales/<语言>.yaml       译文：英文原文 → 译文，如 locales/zh-CN.yaml
├── seed.yaml                 可选：安装时自动导入的演示种子数据，支持一键清理
├── setup.yaml  docs/guide.md 可选：安装后的初始化与使用说明
├── try.yaml                  可选：pkg try 与 pkg check 跑的主线脚本，不进制品
└── pages/ queries/ functions/ agents/ tests/ …  其余资源按目录放
```

例子见 [packages/crm](../packages/crm)。

## package.yaml

| 字段 | 说明 |
|---|---|
| `id` | 包的标识，如 `crm`。发布后不改 |
| `version` | 语义版本，见 [版本规则](versioning.md) |
| `namespace` | 包内名字的前缀 |
| `title`、`description` | 市场里显示的标题与简介（英文原文） |
| `listing` | 分类，见 [分类与标签](taxonomy.md) |
| `requires` | 可选：依赖的其他包与版本范围，如 `manufacturing.core@^1.0.0` |
| `roots` | 安装时的根资源，一般是应用：`{app: build, kind: app, name: crm}` |
| `artifact` | 制品文件名，也是 Release 里的资产名 |

## 对象

```yaml
name: deal
namespace: crm
title: Deal
plural: Deals
icon: briefcase               # 菜单与记录页的图标，见下文
display: title                # 记录的标题字段
naming: DEAL-{year}-{n:5}     # 记录编号；每个业务对象都写
scope: {owner: owner}         # “本人”“本单元”按哪个负责人字段算
sets: {lines: crm.dealline}   # 指向本对象的子记录集合，公式里用

fields:
  - {name: amount, title: Amount, type: money, required: true, group: Deal}
  - {name: probability, title: Probability %, type: integer, from: stage.probability}
  - {name: weighted, title: Weighted amount, type: money, formula: "amount * coalesce(probability, 0) / 100"}
  - {name: stage, title: Stage, type: reference, ref: crm.stage, default: qualification, aside: true}

states:                       # 生命周期；只有动作能改
  - {name: open, title: Open, tone: info, description: In the pipeline.}
  - {name: won, title: Won, tone: success, description: Closed as won.}
actions: [win, lose, reopen]  # objects/deal/actions/ 里的文件，按这个顺序出现在记录页

access:
  - {role: salesrep, read: team, create: true, edit: true}
  - {role: salesmanager, read: all, create: true, edit: true, archive: true}

view:                         # 列表的默认样子：table、board（按 lanes 分列）或 calendar（按 dates）
  version: 1
  layout: board
  lanes: stage
  columns: [title, account, stage, amount]
  sort: [{sortKey: expectedclose, direction: ascending}]
  group: none
  filters: []
  search: ""
  inbox: {member: owner, due: nextstepdue, open: {state: [open]}}   # 到期进负责人的收件箱
```

- `type` 不写，`pkg` 取 `namespace.name`。`group` 是记录页的分节，`aside: true` 放右栏（负责人、阶段这类）。
- 字典（阶段、来源、原因）是带 `records` 的对象：`records` 列出随包安装的参考记录，每条带自己的 `id`。
- `sets: {deals: {object: crm.deal, limit: 500}}` 是完整写法；集合名默认就是子对象上 `inverse` 的名字。

## 动作

`objects/<对象>/actions/<动词>.yaml`，动作名取文件名。

```yaml
title: Mark won
description: Close this deal as won and make its account a customer.
from: [open]
inputs:
  - {name: closedate, title: Close date, type: date, help: Defaults to today.}
transaction:
  guard: amount != empty                 # 可选：不满足就拒绝，配 message
  steps:
    - target: $subject                   # 更新这条记录本身
      set:
        state: "'won'"
        closedate: coalesce(input.closedate, today())
    - name: account
      target: $subject.account           # 更新它引用的那条
      set: {relationship: "'customer'"}
```

- `target` 写类型名就是新建（`target: crm.contact`），写 `$subject` 或 `$subject.<引用字段>` 是更新；`when` 决定这一步做不做。
- `set` 的每个值是一个表达式；字面文字加单引号（`"'won'"`），`$subject` 指这条记录。前面步骤新建的记录用 `step.<步骤名>` 引用。

## 表达式

`guard`、`when`、`set`、字段的 `from` 与 `formula`、流程的 `trigger` 都用同一种写法，`pkg` 按字段类型编译成平台的表达式：

| 写法 | 意思 |
|---|---|
| `amount`、`stage.probability`、`input.reason`、`step.deal` | 字段、沿引用取字段、动作输入、前面步骤的记录 |
| `'won'`、`10`、`true` | 字面值 |
| `=  !=  <  <=  >  >=`、`x in ['a', 'b']`、`x = empty`、`x != empty` | 比较、属于、为空 |
| `and  or  not` | 逻辑 |
| `+  -  *  /` | 算术；金额可乘除数字 |
| `coalesce(a, b)`、`if(条件, 是, 否)`、`today()`、`now()`、`me()` | 取第一个非空、条件、今天、现在、当前成员 |
| `sum(lines.amount)`、`count(lines)`、`sum(deals, if(item.state = 'open', item.amount, item.amount * 0))` | 对集合汇总；`item.` 指集合里的那一条 |

流程的 `trigger` 用 `subject.<字段>` 取被触发的记录。
YAML 的 `{...}` 一行里，含逗号的表达式要加引号：`formula: "coalesce(a, 0)"`。

## 应用与菜单

```yaml
name: crm
title: CRM
icon: user-group
pages: [crm.lead, crm.deal, …]          # 应用里的全部页面
groups:                                  # 菜单分组；按工作的顺序分，不要一个“全部”
  - {title: Selling, pages: [crm.lead, crm.deal]}
  - {title: Settings, layout: settings, roles: [salesmanager], pages: [crm.stage, crm.source]}
dashboard: […]                           # 有仪表盘时菜单第一项是它
```

`layout: settings` 的分组在菜单里只占一项，打开是一页：每个对象一张可折叠的表，单元格就地改；
对象按 `position` 排序时每行可上移下移，有新建与归档时每张表可添加、每行可归档。字典与配置都放这样的分组里，不要一个字典一个菜单项。

对象的标准页面不用写：`pages` 里列了对象、又没有同名的 `page.yaml`，`pkg` 就生成列表加详情页。

## 图标

对象与应用的 `icon` 取 [Heroicons](https://heroicons.com) 的 outline 名字（`user-plus`、`briefcase`、`building-office-2`）。
平台只带一部分，`pkg check` 拒绝不认识的名字；要新的图标，给平台提改动，把它加进 `descriptor/icons.go` 与前端的 `pages/icons.ts`。

选图标的规矩：一个对象一个意思，同一应用里不重复；字典用说明“它是什么”的图标（阶段 `queue-list`、丢单原因 `x-circle`），不用通用的方块。

## 译文

`locales/zh-CN.yaml` 是“英文原文: 译文”的映射，覆盖标题、字段、选项、状态、动作、帮助、菜单分组、仪表盘与通知文字。
`pkg` 把它并进应用的 `languages`。同一原文在包里只有一个译文：两处意思不同就用不同的英文（“Follow-up”与“Follow-up stage”）。
有 `locales/` 时，`pkg check` 列出没有译文的原文（标题、复数、说明、帮助、字段分组、选项名、提示与通知），一条没译就不通过。

## 生成与检查

- 不写依赖、能力、动作输入模式与模式版本：`pkg` 用宿主的同一实现算出，写进制品。源里出现 `schemaVersions` 会被拒。
- 不在已知位置的 `.yaml` 会被拒，避免写错目录的文件被悄悄忽略；`actions/` 里没被对象列出的动作文件也会被拒。

## seed.yaml

可选的演示种子数据，随包编进制品（`blueprint.seed`），首次安装时自动导入为可交互的示例业务记录；点击应用侧栏底部的「清理演示数据」后仅归档这些演示记录，保留字典参考数据与用户自建记录，且按钮自动隐藏。

```yaml
records:
  - type: crm.account
    id: demo-account-1
    values:
      name: Northwind Precision Manufacturing
      industry: manufacturing
```

- 每条记录必须包含包内已定义对象的 `type`、唯一 `id` 与 `values` 对象，总量不超过 200 条。
- 严禁使用真实人名、公司、邮箱或电话；域名统一使用 `.example`。

## try.yaml

`pkg try <包目录>` 把包装进内存租户，按这个脚本提交动作、打印记录；`pkg check` 也跑它。键写错会被拒。

```yaml
roles: {crm: salesmanager}          # 给试跑成员的角色，平台与构建的管理角色总是有
at: 2026-11-23T09:00:00Z            # 可选：固定时间，时限与默认日期因此可重复
steps:
  - do: crm.lead.create             # 动作的 schema
    on: crm.lead/L1                 # 目标：<类型>/<id>
    with: {fullname: Zhou Ning, budget: {amount: 300000, currency: CNY}}
    show: [stage, owner]            # 不写就打印整条记录
  - do: crm.lead.convert
    on: crm.lead/L1
    with: {expectedclose: "2026-12-31", nextstep: Send the proposal, nextstepdue: "2026-11-25"}
  - read: crm.deal/{crm.lead/L1.deal}   # {<类型>/<id>.<字段>} 取已有记录的值
    expect: {stage: qualification}      # 按子集比对，不符就失败
  - do: crm.lead.convert
    on: crm.lead/L1
    refused: true                   # 这一步必须被拒
```

## package.lock.json

`pkg lock` 生成，CI 核对它没有过期。它记下每个资源的摘要、契约版本，以及每个对象的模式版本历史：
对象的模式一变就追加一条；与上一版不兼容（删字段、改类型、加必填）时升一个族，平台据此拒绝不兼容的升级。

## 市场封面（非运行时资源）

可在 `packages/<id>/assets/cover.avif` 放市场封面，静态图片只用于市场卡片与产品介绍，不进入 `pkg build` 制品，也不赋予应用任何新能力。官方库封面由 Platform 从这个路径加载，未提供封面的包继续展示默认图标。

仅替换或新增封面时不需要修改 `package.yaml` 的版本，也不会修改不可变 Release 的内容或摘要。若同时修改 YAML 源、对象、动作等运行时资源，必须依照 [版本规则](versioning.md) 升版、更新 lock/changelog 并走发版流程。

### 统一尺寸与质量

- **展示结构**：市场卡片采用响应式 Grid，封面是卡片正文旁的缩略图，宽度不超过 124 CSS px，保持 4:3 裁切，不允许封面决定整卡高度。
- **交付资源**：AVIF，推荐 720×540；小封面最低约 480×360，保持 4:3。两种尺寸都已覆盖高密度显示屏的缩略图需求。
- **质量优先**：实景摄影优先采用相当于 AVIF quality 55–65 的压缩级别；建议约 15–80 KB/张，绝不为了几 KB 的目标牺牲可辨识细节；最终按实际图片质量调整。
- **检测方式**：核对 AVIF 文件头、像素尺寸、文件大小、SHA-256；在真实卡片的 100% 和 200% 缩放比例检查边缘和细节。页面缩略图用 cover 居中裁切，不拉伸、不改动文字排版。
- **主题多样性**：封面贴合各包真实业务场景，避免各应用使用相同素材或重复的抽象玻璃元素。包内封面来自 `packages/<id>/assets/cover.avif`；内置索引的专用封面来自 `marketplace/covers/`。
- **版本边界**：封面仅为目录展示资产，改变图片本身不需要提高声明式 Package 版本；变更运行时制品仍需遵守不可变 Release 的升版和锁定规则。
