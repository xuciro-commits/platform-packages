---
name: open-app-intake
description: 把一个开放应用（Frappe、Odoo/OCA、Zammad、EspoCRM……）读懂后重新设计成本仓库的官方产品包，从普查一直做到发版。用户说“接入 X”“做一个 helpdesk 包”“把 Y 做成官方包”或要给已有官方包扩一项能力时使用。
---

# 接入开放应用

产出是一个 `redesign` 的官方包：读懂几家成熟产品的业务与交互，按平台的对象、状态、动作、角色重新设计，Apache-2.0 发布。
不翻写定义，不复制代码、文案与图标。为什么这样做见 [docs/intake.md](../../../docs/intake.md)，格式见 [docs/format.md](../../../docs/format.md)。

按下面的顺序做，每步的“检查”过了再进下一步。一步卡住时，先查本文末尾的坑表与 intake.md 第 6 节。

## 0. 定范围

- 输入：用户的一句需求，[docs/sources.md](../../../docs/sources.md) 的波次与许可矩阵。
- 做：确认这个能力不在已有官方包里；重叠就扩展已有的包，不另起一个。定 `id`、`namespace`（安装后不可改）、`listing.capabilities`。
- 产出：一句话写进 `packages/<id>/DESIGN.md` 开头：“用户一打开它，第一件事做什么”。CRM 是“销售的一天从下一步开始”。
- 检查：这句话能决定默认视图、收件箱和仪表盘第一格；写不出就是还没读懂，回去读。

## 1. 读三家

- 输入：sources.md 里这个能力的来源（至少三家，不同生态各一）。
- 做：先读文档与演示，再在演示站点或本地实例点一遍主线，最后才看定义。Frappe 应用用
  `node scripts/frappe-read.mjs <应用检出目录> [被链接的其他应用] [--types]` 读 DocType（只读，不执行来源代码）。
- 产出：DESIGN.md 的“套路”表（`套路 | 在哪看到 | 我们怎样做`），六到十条；每家至少一处“设计债”（它为什么别扭、我们怎样避开）。
- 检查：表里写的是交互纪律（必须有下一步、阶段与结果分开、首次响应时限），不是字段清单。
- 易错：照着最熟的一家抄字段；把来源的状态字典（Won/Lost/Closed）原样搬进字典。生命周期归平台状态与动作。

## 2. 落到六个词

- 做：填 intake.md 第 3 节那张表：状态、字典、动作、派生、角色与范围、注意力。
- 产出：DESIGN.md 的“六个词”表与对象表（对象 | 是什么 | 关键字段）、菜单分组、角色、流程、仪表盘各格。
- 检查：每条套路都落到某个词上。落不上的二选一：记成平台缺口，或这一版不做，写进 DESIGN.md 的“取舍”。
- 平台缺口：表现不够用（缺组件、缺交互）时，在平台仓库做成通用组件（Astryx 模板 + StyleX，放 `frontend/src/pages/`），
  所有包同时得到；规则缺口（宿主拒了合理的定义）进平台 roadmap 的 2.8.8。不在包里绕。

## 3. 手写源

- 输入：DESIGN.md、`packages/crm`（结构照抄它）、`templates/app`。
- 做：`cp -r templates/app packages/<id>`，然后逐个对象写 `objects/<对象>/object.yaml`，一个动作一个 `actions/<动词>.yaml`，
  应用写 `applications/<应用>.yaml`，流程写 `flows/<名>.yaml`，译文写 `locales/zh-CN.yaml`。
- 规矩：
  - 手写 YAML，不写生成器；表达式用紧凑写法（`budget != empty`、`coalesce(input.account, step.account)`），含逗号的加引号。
  - 每个业务对象有 `naming` 与 `icon`（Heroicons outline 名，必须在平台图标表里）；字段写 `group`，负责人、阶段、状态类写 `aside: true`。
  - 列表按用途选样子：管道用看板（`layout: board` + `lanes`），活动用日历（`dates`），从属记录按上级分组。
  - 菜单按工作顺序分组，字典与配置进 `layout: settings` 的“设置”组，只给主管角色。挂在记录上的跟进类对象（活动、备注、回复）
    用 `oneOf` 引用主对象，时间线自动收进来；要置顶就给它一个可编辑的 `pinned` 布尔字段。
  - 标准的列表加详情页不写 `page.yaml`，由 `pkg` 生成。
- 产出：`package.yaml`（`listing` 写全，`source.relation: redesign`，`stage: preview`）、README、`CHANGELOG.md` 的 `## <version>`、LICENSE。
- 检查：`pkg lock packages/<id>` 与 `pkg check packages/<id>` 通过；有 `locales/` 时一条没译都不过。

## 4. pkg try 跑主线

- 做：在包根目录写 `try.yaml`（不进制品），按 DESIGN.md 的主线排步骤；在平台仓库的 `capabilities/server` 里
  `go run ./cmd/pkg try <包目录>`。它把包装进内存租户，flow、参考记录与编号随之生效，每步之后一直跑到没有待办的工作。
- 写法（格式见 [源格式](../../../docs/format.md) 的 try.yaml 一节）：`roles` 给角色；每步 `do` + `on: <类型>/<id>` + `with`，
  或只 `read`；`show` 选要打印的字段，`expect` 按子集比对，`refused: true` 要求被拒；`{<类型>/<id>.<字段>}` 引用已有记录的值。
- 产出：主线每一步的记录状态；每个派生值（概率、加权、合计、汇总、时限）手算对一遍，对上的写进 `expect`。
- 检查：主线走到终态，流程（分配、时限、提醒）都触发了，拒绝信息说得清楚；`pkg check` 也会跑这个脚本，CI 一起守住。
- 易错：被拒时它会列出字段级问题，先看那几行；一轮浏览器一分钟以上，没过 `pkg try` 别上浏览器。

## 5. 浏览器里走一遍

- 做：`pkg build -o .build/<id>.json packages/<id>`，在平台的夹具宿主（`make frontend-host`，18511）用 `blank` 租户从文件安装，
  按 DESIGN.md 的“验收”一节以各个角色走主线。需要回归时在平台仓库加 trunk 步骤，单个用例控制在一分钟内。
- 检查：菜单、看板、时间线、设置页、仪表盘都是设计稿说的样子；下级看不到上级的数据；图标没有显示成通用方块。
- 负责人亲手走一遍并说出第一感觉，这一步才算过。

## 6. 提 PR

- 做：开分支；`node scripts/packages.mjs download`，`pkg diff packages/<id>`，`node scripts/packages.mjs catalog`，
  把 `catalog.json` 与包一起提交；PR 模板逐项勾，[评审清单](../../../docs/review-checklist.md) 自查一遍。
- 检查：CI 的 check 通过（布局、`pkg check`、`pkg diff`、目录一致、可重现构建）。
- 易错：忘了更新 `catalog.json`；改了已发布版本却没升版本号；新字段设成必填（升级会被拒）。

## 7. 合入与发版

- 合入后 release 工作流打 `<id>/v<version>`，发带 `SHA256SUMS` 与来源证明的 Release（[发版](../../../docs/release.md)）。不手打 tag。
- 在平台市场“管理库”刷新官方库，确认新版本能装上；已装旧版本的租户走“审阅升级”。

## 8. 回填

- intake.md：新坑进第 6 节，新套路进第 2 节；本 Skill：哪一步缺说明就补哪一步。
- sources.md：这个能力标成已接入；平台 roadmap：新发现的缺口各记一项。

## 坑（截至平台 v0.2.6）

| 现象 | 原因 | 怎样做 |
|---|---|---|
| `{...}` 一行里的表达式被截断 | YAML 把逗号当分隔 | 含逗号的表达式加引号 |
| `set` 里写 `$subject.x` 报“has no field $subject” | 表达式按主体解析，`$subject` 被当成字段名 | 写裸名 `responsesla`，新建别的对象时也指主体；`$subject` 只整写：`target: $subject`、`target: $subject.<引用>`、`<引用>: $subject` |
| 公式报“required operand is missing” | 参与运算的字段为空 | 参与公式的金额设成必填，或 `coalesce` 给零 |
| 流程输入写 `source: now` | 不支持，运行时静默失败 | 只写字面量、主体与步骤 |
| 动作的 guard 里写 `count(lines)` 报 “rule collection lines is undeclared” | 动作条件读不到对象的集合 | 在对象上加公式字段 `items: count(lines)`，guard 写 `items > 0` |
| 经理用 `read: below` 或 `unit`，安装预检报“无法检查依赖” | 这两级要记录上的单元字段与组织结构名，包里写不出 | 用 `team`（本单元同事的记录）；v0.2.6 起 `pkg build` 直接指名报错 |
| `pkg diff` 报 the changes need a minor release | 加了资源或字段而只升了补丁（1.0 以后） | 按版本规则升次版本；0.x 下补丁算次版本 |
