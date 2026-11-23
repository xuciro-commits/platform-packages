# 发版

发版只有一条路：PR 合入 main，release 工作流（`.github/workflows/release.yml`）为还没有 tag 的版本打 tag 并发 Release。没有人手打 tag。

## 作者在 PR 里做的

1. 升 `package.yaml` 的 `version`，按 [版本规则](versioning.md) 选哪一位；`CHANGELOG.md` 写这一版的一节。
2. `pkg lock packages/<id>`，再 `pkg diff packages/<id>`：先 `node scripts/packages.mjs download` 取回已发布版本，
   它列出与上一版相比的资源与字段变化，平台会拒的升级与升得不够的版本号都在这里报，和平台的“审阅升级”是同一份代码。
3. `node scripts/packages.mjs catalog`，把更新后的 `catalog.json` 一起提交。目录里的制品地址与摘要是确定的：
   地址是 `releases/download/<id>/v<version>/<artifact>`，摘要是这份源的构建结果，合入前就能写好。

CI 再跑一遍上面这些，并核对 `catalog.json` 与源一致、两次构建字节相同。

## 合入之后

release 工作流在 main 上对每个包：tag `<id>/v<version>` 已存在就跳过；否则用 `platform.lock` 的 `pkg` 构建制品，
摘要必须与 `catalog.json` 里的一致，再写 `SHA256SUMS`、附构建来源证明（GitHub attestations），以 CHANGELOG 那一节为说明发 Release。

- tag 规则：`*/v*` 不可删除、不可移动。一个 `id@version` 发出后不改、不删，有问题发新版本。
- 平台按目录里的摘要核对下载到的制品，不一致即拒；Release 下载地址会跳转，平台每一跳都重新校验 HTTPS。
- 核对来源证明：`gh attestation verify crm.json --repo xuciro-commits/platform-packages`。

## 平台怎样找到它

在市场的“管理库”里加 `https://github.com/xuciro-commits/platform-packages`（对话框里有一键添加），
平台读 main 上的 `catalog.json`。目录先于 Release 合入，工作流跑完的这一两分钟里，新版本会显示但装不上，刷新即可。
