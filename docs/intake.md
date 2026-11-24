# 开放应用接入：黄金路线

看过很多小说再写自己的小说。成熟产品的骨架大同小异，好产品赢在几处交互纪律。我们读懂它们解决什么、靠什么套路让人用得顺，
再按平台的对象、状态、动作、角色重新设计。不翻写定义，不复制代码与文案。产出以 Apache-2.0 发布，`source.relation: redesign`。

## 1. 先定一句话

写不出“用户一打开它，第一件事做什么”，就还没读懂。CRM 的一句话是“销售的一天从下一步开始”。
这句话决定默认视图、收件箱、必填项和仪表盘的第一格。

## 2. 读三家以上，找套路，不找字段

- 读的顺序：它的文档与演示 → 实际点一遍主线 → 最后才看定义（Frappe 用本仓库的 `scripts/frappe-read.mjs` 读 DocType，只读不执行）。
- 记套路：一张表写“套路 | 在哪看到 | 我们怎样做”。CRM 的八个套路是：两段式资格判断、阶段与结果分开、每个商机必须有下一步、
  首次响应时限与公平分配、加权与预测类别、联系人在商机里有角色、一条时间线、结构化的赢丢单。
- 找来源的设计债：Frappe CRM 把 Won、Lost 放进状态字典，只好加约束防止随手改。我们把生命周期交给平台状态与动作，阶段只是进行中的位置，约束就消失了。
  每个来源至少找出一处这样的债，写进设计稿，这是重新设计的价值所在。
- 许可只决定能不能“转换”，不限制参考；参考 GPL、AGPL 应用的业务与交互照常，产出仍是 Apache-2.0。

## 3. 把产品落到平台的六个词上

| 平台词 | 产品问题 | CRM 的答案 |
|---|---|---|
| 状态（`states` + `from`） | 这个东西的生命有几段？哪些只能由一个动作改？ | 线索 open/converted/disqualified；商机 open/won/lost；活动 open/done/canceled |
| 字典（带 `records` 的类型） | 哪些分类由租户维护、带颜色、顺序与参数？ | 商机阶段带概率、预测类别与出阶段条件；来源、行业、地区、丢单原因 |
| 动作（带 `inputs` 与事务） | 哪一步必须一次做完、必须问清什么？ | 转商机一次建客户、联系人、商机与商机联系人；丢单必填原因 |
| 派生（`from`、`formulaExpr`、`agg` + `in`） | 哪些数不该让人填？ | 概率随阶段、加权金额、产品行金额与合计、客户的管道与已赢金额 |
| 角色与范围（`access`、`scope`） | 谁看谁的？ | 销售看本单元，经理看全部并管设置 |
| 注意力（`view.inbox`、`lanes`、`dates`、flow、仪表盘） | 什么时候把什么推到谁面前？ | 下一步到期进收件箱并提醒；新线索超时通知；看板按阶段 |

先填这张表再写一行 YAML。一个需求落不到这六个词上，要么是平台缺口（记进 roadmap），要么这一版不做。

## 4. 写源

- 直接手写 YAML，格式见 [源格式](format.md)；照着 `packages/crm` 抄结构。不用脚本生成 YAML：生成器会变成第二份源，社区看不懂也改不了。
- 一个动作一个文件（`objects/<对象>/actions/<动词>.yaml`），表达式用紧凑写法（`budget != empty`、`coalesce(input.account, step.account)`）。
- 每个业务对象写 `naming`（否则记录标识是“chg-89-contact”这种）与 `icon`；字段写 `group` 与 `aside`：负责人、阶段、状态类放右栏，正文按分组。
- 菜单按工作的顺序分组（CRM：销售、客户、跟进、资料、设置），不要一组“全部”；字典与配置放进只给经理的“设置”。
- 列表的默认样子按对象的用途定，不要全是表格：管道用看板（`layout: board`、`lanes`），活动用日历（`calendar`、`dates`），联系人按客户分组（`group`）。
- 译文写在 `locales/zh-CN.yaml`。标准的列表加详情页不写，`pkg` 生成；只有真要不同的页面才写 `page.yaml`。
- 平台的表现不够用时（比如字典该是可拖动排序的设置表、记录页该有活动时间线），记下来做成平台的通用组件，所有包同时得到；不在包里绕。

## 5. 先跑 pkg try，再上浏览器

浏览器主干一轮一分钟以上，宿主启动就要二十多秒。先在包根目录写 `try.yaml`，用 `pkg try` 在内存租户里按主线提交动作并打印记录，
一轮几秒到十几秒。它替代了早先的临时探针：安装、监听与流程跑完、被拒时取出字段级问题，这三件事它都做了。

脚本同时是回归：`pkg check` 会跑它，CI 每个 PR 都守住主线。写法见 [源格式](format.md) 的 try.yaml 一节。

## 6. 平台的坑（截至 v0.2.6）

| 现象 | 原因 | 怎样绕 |
|---|---|---|
| `{...}` 一行里的表达式被截断 | YAML 把逗号当成分隔 | 含逗号的表达式加引号 |
| 图标显示成通用方块 | 名字不在平台的图标表里 | `pkg check` 会报；要新图标给平台提改动 |
| 新包装不上：“unsupported integration version 1” | v0.2.0 的 pkg 给集成资源写错首个版本 | 用 v0.2.1 的 pkg |
| 公式报“required operand is missing” | 参与运算的字段为空 | 参与公式的金额设成必填，或用 `coalesce` 给零 |
| 流程输入写 `source: now` | 不支持，安装不报，运行时静默失败 | 不用；只写字面量、主体与步骤 |
| 动作的 guard 里写 `count(lines)` 报“rule collection lines is undeclared” | 动作条件读不到对象的集合 | 在对象上加公式字段 `items: count(lines)`，guard 写 `items > 0` |
| 经理用 `read: below` 或 `unit`，安装预检报“无法检查依赖” | 这两级要记录上的单元字段与组织结构名，包里写不出 | 用 `team`；v0.2.6 起 `pkg build` 直接指名报错 |
| 布尔字段写 `default: true` 报错 `cannot unmarshal bool into string` | `object.yaml` 的 `default` 统一按字符串解析 | 写成 `default: "true"` |
| 事务动作报 `Transaction wrote ... more than once` | 单次事务中 `$subject` 只能被写入一次 | 合并为单个 `target: $subject` 步骤 |
| `if()`/`coalesce()` 报 `operand/result types differ` | 引用字段（`reference`）与字面字符串不可混在同一分支 | 同类型比较，或拆成带条件字段与独立动作 |
| v0.2.10 之前动作输入写 `type: member` 报“has no type member” | 平台还没有成员类型的动作输入 | v0.2.10 起可用，`holder: input.holder` 直接写入成员字段（assets 的领用）；更早的平台改由记录右栏改人 |
| `pkg check -packages` 同租户多包安装报 `Managed resources are read-only` | 当前平台蓝图草稿 ID 与默认页名按对象裸名 `object.name`（未带 `namespace`）落库，不同包使用相同裸名会碰撞 | 避免与已有官方包共用裸名（如 `crm` 已用 `contact`/`stage`，`helpdesk` 改用 `requester`/`ticketstage`），CI 务必跑 `pkg check -packages` |


v0.2.6 已修、不用再绕的：带默认或带出的必填字段可以不给；动作参数可以是 `money`；flow 的 `actions` 不写由 `pkg` 补齐；
新建步骤按初始状态判断 `when: state=…`，带值转到别的状态不再被拒（值保留、界面隐藏）；未发布版本改模式直接 `pkg lock`。
## 7. 验收与发布

1. `pkg check packages/<id>`；探针走完主线，每条派生值手算对一遍。
2. 夹具宿主（18511）装进 `blank` 租户，负责人按设计稿的“验收”一节手走一遍，记下第一感觉。
3. 包库开分支提 PR，带上 `catalog.json`（CI 用 `platform.lock` 的发行版 `pkg`），合入后由 release 工作流打 `<id>/v<version>`（[发版](release.md)）。
4. 回填本文件：新坑进第 6 节，新的套路进第 2 节。
