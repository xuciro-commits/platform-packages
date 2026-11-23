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
├── setup.yaml  docs/guide.md 可选：安装后的初始化与使用说明
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

## 生成与检查

- 不写依赖、能力、动作输入模式与模式版本：`pkg` 用宿主的同一实现算出，写进制品。源里出现 `schemaVersions` 会被拒。
- 不在已知位置的 `.yaml` 会被拒，避免写错目录的文件被悄悄忽略；`actions/` 里没被对象列出的动作文件也会被拒。

## package.lock.json

`pkg lock` 生成，CI 核对它没有过期。它记下每个资源的摘要、契约版本，以及每个对象的模式版本历史：
对象的模式一变就追加一条；与上一版不兼容（删字段、改类型、加必填）时升一个族，平台据此拒绝不兼容的升级。
