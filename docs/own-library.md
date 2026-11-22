# 自建包库

第三方可以用同样的结构建自己的包库：

1. 照这个仓库的布局建仓库：`packages/<id>/`、`platform.lock`（写你对齐的平台发行版，如 `v0.2.0`）、`.github/workflows/check.yml`、`scripts/packages.mjs`。
2. 包的命名空间用自己的前缀，不用本仓库已有的 `id` 与命名空间。
3. 发版同 [发版](release.md)：`<id>/v<version>` tag，Release 带制品与 `SHA256SUMS`。

租户安装第三方包：交付 → 市场 →「⋯ → 从地址或文件安装」，粘贴制品的 https 地址并填上它的 SHA-256。
审阅页把外部包标为“包自己的说法，未经审核”。包里只有声明，不执行代码；安装不授予任何权限。
