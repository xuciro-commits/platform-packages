# 发版

- 一个版本一个 tag：`<id>/v<version>`，如 `crm/v0.1.21`。tag 只在合入 main 的提交上打。
- Release 的资产：制品（文件名取 `package.yaml` 的 `artifact`）与 `SHA256SUMS`。发出后不改、不删；有问题发新版本。
- 平台按 `SHA256SUMS` 里的摘要核对下载到的制品，不一致即拒。
- 发版前：`CHANGELOG.md` 写好这个版本，CI 通过，评审通过。
