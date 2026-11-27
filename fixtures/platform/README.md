# Platform 验收包（单一真相）

- 正式业务包唯一作者态：仓库根 `packages/<id>/`。CRM、party、geo、uom 等不在夹具树复制。
- 本目录只保留三个独立验收包的当前作者态：application.production-provider、connectortrial、connectortrial-contract。它们并非正式制造/库存/电话业务包，不进入市场。来自 Platform 提交 40d39854f4e2d5d5e507b713db5a654cc2a61727，来源权属不变。
- 不提交任何构建 JSON、旧 CRM 作者态或版本化历史夹具。锁文件是编译锁，不是可安装制品。
- Platform 测试由固定 Package Git 提交的权威源构建临时制品，测试结束清理。升级回归如确需旧版本，从已发布的不可变 Release 按版本/摘要取回，或从固定历史提交临时构建；不得在当前树保留历史副本。旧 CRM 测试改用正式 CRM 模型；无正式迁移语义的历史路径不得冒充通过。

```sh
node scripts/check-platform-fixtures.mjs --pkg=/absolute/path/to/pkg
# 构建单个验收包至测试临时目录（不要写回源码目录）
pkg build -o /tmp/production-provider.json fixtures/platform/packages/application.production-provider
```

平台消费者切换必须先验收，再删除 Platform 的旧目录。工具链只使用统一 platform.lock；不为测试新增第二套版本。
