# 来源应用

官方包来自开放应用：读懂它解决什么、怎样流转，按平台的对象、动作、状态与角色重新设计（`source.relation: redesign`），不搬来源的定义、代码与文案。
这一页回答：有哪些开放应用可以参考，许可允许做什么，先接哪个。许可以各仓库根目录的 LICENSE 文件为准，2026-11-22 经 GitHub API 核实。

## 借鉴什么，决定用什么许可

我们借的是业务与产品设计，不是代码。决定许可的是**借了什么**，不是来源用什么许可。

| 借鉴的内容 | 要不要继承来源的许可 | 风险 | 我们怎样做 |
|---|---|---|---|
| 业务流程、单据流转、状态与审批 | 不需要 | 低 | 照常借，写进设计稿 |
| 模块划分、职责边界、架构思想 | 不需要 | 低 | 照常借 |
| 设计模式、算法原理 | 不需要（专利与商业秘密另论） | 低 | 照常借；对来源声称有专利的做法先问负责人 |
| 数据流、字段的业务含义 | 不需要 | 低 | 照常借，字段按平台的类型与命名重写 |
| 通用 API 与界面交互的思路 | 不一定 | 中 | 只借思路，不对着来源逐项复刻接口与页面 |
| 类名、字段名、目录结构 | 不自动触发 | 中 | 用平台自己的命名；不照搬来源的目录与命名体系 |
| 整套独创的内部组织与实现结构 | 视情况 | 中高 | 不照搬；拿不准时问负责人 |
| 逐个定义翻成我们的格式（DocType JSON → 对象 YAML） | 通常需要 | 高 | 这是转换，不是重新设计；只对 MIT、Apache 等宽松许可的来源做 |
| 复制代码、注释、文案、文档、图标 | 需要相应授权 | 高 | 不做 |

- 换一种语言或格式不等于独立开发：把 GPL、AGPL 应用的定义逐个改写成 YAML，仍是它的衍生作品。
- 按上表“低”“中”借来的，做出来就是我们自己的设计（`source.relation: redesign`），以本仓库的 Apache-2.0 发布，不必沿用来源的 GPL 或 AGPL。
  来源的许可只决定能不能“转换”，不限制能不能参考：Frappe CRM、Helpdesk、OCA、Odoo 社区版一样可以作为重新设计的参照。
- 来源是 MIT、Apache-2.0 等宽松许可时，可以直接转换定义（`derived`），以 Apache-2.0 发布，保留来源的版权声明与 NOTICE。
- 来源是 GPL、AGPL、LGPL 时不做转换；真要转换的包沿用原许可，放在本仓库之外。
- 不用来源产品的名字与商标；`source` 字段写明参考了谁。重新设计的设计稿里写清每个对象与流程参考了哪里、改了什么、为什么。
- 向客户交付前，负责人先取得法律意见。

| 来源许可 | 例子 | 重新设计 | 转换 |
|---|---|---|---|
| MIT、Apache-2.0、MPL-2.0 | Frappe Framework、Builder、Wiki；InvenTree；Apache OFBiz、Fineract；OpenMRS | 可以 | 可以（MPL 按文件保留许可） |
| GPL、AGPL、LGPL | ERPNext、HRMS、Frappe CRM、Helpdesk、LMS；OCA；Odoo 社区版；Dolibarr、Tryton；Twenty、Zammad、Plane 等 | 可以 | 不在本仓库 |
| 非开源（可见源码） | Akaunting（BSL）、Invoice Ninja（Elastic 2.0）、Odoo 企业版 | 不碰 | 不碰 |

## 各家

星数与最近提交只用来判断是否还活跃。

### Frappe（Python，元数据驱动，DocType 与我们的对象最接近）

| 应用 | 许可 | 星 | 业务 | 判断 |
|---|---|---|---|---|
| erpnext | GPL-3.0 | 41.5k | v16 固定检出声明 21 个模块（见 [长期计划](erpnext/plan.md) 与 [普查](erpnext/inventory.md)）：accounts、selling、buying、stock、manufacturing、projects、assets、maintenance、quality_management、support、crm、subcontracting | 按能力拆成多个包重新设计 |
| hrms | GPL-3.0 | 9.1k | hr、leaves、shift_and_attendance、expenses、payroll、performance、recruitment、tax_and_benefits | 拆成人事核心与薪资两包 |
| crm | AGPL-3.0 | 4.0k | 线索、商机、组织、联系人、任务、备注 | 第一个，已有能力矩阵 |
| helpdesk | AGPL-3.0 | 3.5k | 工单、SLA、指派、知识库、客户门户 | 第二个 |
| lms | AGPL-3.0 | 3.4k | 课程、章节、测验、证书、批次 | 第三波 |
| education | GPL-3.0 | 0.7k | 学生、课程表、考核、收费 | 第三波 |
| lending | GPL-3.0 | 0.4k | 贷款申请、放款、还款计划 | 与 Fineract 一起看 |
| insights | AGPL-3.0 | 1.0k | BI | 不做：平台不做 BI（intent） |
| gameplan、raven | AGPL-3.0 | 0.5k、0.9k | 讨论区、即时消息 | 不做：不是业务对象 |
| builder、wiki | MIT | 2.5k、0.5k | 网站搭建、Wiki | 不做网站；Wiki 留待知识类需求 |
| print_designer | AGPL-3.0 | 0.5k | 单据打印模板 | 平台能力（plan 阶段 3 的 `PrintPreview`），不是包 |
| webshop、ecommerce_integrations | GPL-3.0 | 0.2k | 网店、电商对接 | 后面阶段 5 的连接 |
| agriculture | GPL-3.0 | 0.1k | 农业 | 有客户再说 |
| marley（原 healthcare，earthians） | GPL-3.0 | 0.6k | 门诊、病历、检验 | 受监管，后面 |
| books、drive、hospitality、non_profit | — | — | — | 已归档，不看 |

### Odoo 社区版与 OCA（Python）

- `odoo/odoo` 社区版 LGPL-3.0，56k 星，`addons/` 653 个模块；业务应用有 crm、sale、purchase、stock、mrp、account、project、hr、maintenance、repair、fleet；helpdesk 只在企业版。
- OCA 271 个活跃仓库，252 个 AGPL-3.0；按领域：sale-workflow、purchase-workflow、stock-logistics-*、manufacture、project、hr、helpdesk、field-service、maintenance、management-system、contract、dms、knowledge，以及各国本地化 l10n-*。
- 用法：与 Frappe 对照同一能力的另一种设计，挑更好的；OCA 的各国本地化是之后做税务与会计时的参照。

### Apache OFBiz（Java，Apache-2.0）

- `applications/` 12 个：accounting、humanres、manufacturing、marketing、order、party、product、workeffort、content；`ofbiz-plugins` 有 assetmaint、projectmgr、ecommerce。
- 许可最宽：可以由定义转换。它的通用数据模型（party、product、order、workeffort）是对象设计的好参照，界面老旧不看。

### Apache Fineract（Java，Apache-2.0）

- 微型金融与贷款核心：客户、贷款、储蓄、股份、计息、还款计划、会计过账，2.6k 星。
- 做贷款包时与 Frappe Lending 一起看；可以由定义转换。

### Dolibarr（PHP，GPL-3.0）

- `htdocs/` 81 个模块，中小企业全套：客户、报价、订单、发票、采购、库存、项目、工时、请假、工单、合同、捐赠、会员、活动、招聘、会计。7.9k 星。
- 中小企业的操作习惯与默认值很有参考价值。

### Tryton（Python，GPL-3.0）

- `modules/` 下按能力细分的模块，会计、库存、生产设计严谨。GitHub 是镜像，许可在 `trytond/LICENSE`。
- 做会计与库存时对照它的过账与计量单位模型。

### 单一领域的应用

| 应用 | 许可 | 星 | 领域 | 用法 |
|---|---|---|---|---|
| InvenTree | MIT | 7.9k | 零件、BOM、库存、生产、采购、销售 | 库存与制造的主要参照；可以由定义转换 |
| Twenty | AGPL-3.0（部分文件另有许可） | 61k | 现代 CRM | 对照 CRM 的交互 |
| EspoCRM、SuiteCRM、Krayin | AGPL、AGPL、MIT | 3.7k、5.9k、24k | CRM | 对照 CRM |
| Zammad | AGPL-3.0 | 6.1k | 工单 | 对照 Helpdesk |
| OpenProject、Plane | GPL-3.0、AGPL-3.0 | 17.6k、63k | 项目、任务、甘特 | 对照项目包 |
| Snipe-IT | AGPL-3.0 | 15.2k | IT 资产 | 对照资产包 |
| Kimai | AGPL-3.0 | 5.2k | 工时 | 对照工时 |
| OrangeHRM | GPL-3.0 | 1.2k | 人事 | 对照人事包 |
| OpenMRS | MPL-2.0 | 2.0k | 医疗记录 | 医疗包时再看 |
| iDempiere、metasfresh | GPL-2.0、GPL（README 标注，根目录无 LICENSE 文件） | 0.7k、2.5k | ERP | 用不上：与 ERPNext、Tryton 重叠 |

## 接入顺序

每个能力只做一个包，同一能力参考多家、取最好的设计。顺序按三条：对第一个客户的价值、平台今天能不能表达、来源的结构离我们多近。

| 波 | 包 | 主要参考 | 平台要先补的 |
|---|---|---|---|
| 1 | crm | Frappe CRM；Twenty、EspoCRM | 无（阶段 2 已验证） |
| 1 | helpdesk | Frappe Helpdesk；Zammad、OCA helpdesk | 无：SLA、均衡指派、收件箱都已有 |
| 1 | hr-core（员工、请假、考勤、报销） | HRMS；OrangeHRM、Dolibarr | 无 |
| 1 | assets（资产、维护） | ERPNext assets/maintenance；Snipe-IT、OFBiz assetmaint | 无；折旧等会计 |
| 1 | projects（项目、任务、工时） | ERPNext projects；OpenProject、Plane、Kimai | 列表的甘特布局（plan 已列） |
| 2 | inventory | ERPNext stock；InvenTree、Tryton | 数量与计量单位 |
| 2 | purchasing、sales（报价、订单、发票） | ERPNext buying/selling；Dolibarr、OFBiz order | 价格与税 |
| 2 | accounting | ERPNext accounts；Tryton、OFBiz accounting、OCA | 复式过账 |
| 2 | manufacturing、quality | ERPNext；InvenTree、OCA manufacture、management-system | BOM 与工单（依赖 inventory） |
| 3 | payroll | HRMS payroll | 公式与各地规则 |
| 3 | lms、education | Frappe LMS、Education | 无 |
| 3 | lending | Fineract、Frappe Lending | 计息与还款计划 |
| 3 | healthcare | Marley、OpenMRS | 合规评审 |

不做：BI、报表设计器、网站与网店搭建、即时消息、讨论区、POS（离线与硬件）。打印模板是平台能力，不是包。
