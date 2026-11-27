# Platform 验收夹具（非正式业务包）

Platform 的包类验收数据统一归此目录。首次迁入来自固定 Platform 提交 `40d39854f4e2d5d5e507b713db5a654cc2a61727`，逐文件保留原始字节。正式业务包仍在 `packages/`，此目录绝不进入正式 Catalog 或 Release 扫描；旧 CRM 0.1.x 不覆盖正式 CRM。

| 目录 | 内容 |
|---|---|
| `packages/` | production-provider、connectortrial、connectortrial-contract 作者态及原快照 |
| `test-packages/` | 旧 CRM 0.1.22 作者态及快照 |
| `frontend-fixtures/` | 16 个版本化不可变 JSON，用于安装、升级、权限等回归 |

`manifest.json` 记录迁入原路径、字节数及 SHA-256。历史制品不得原地重建；新增或更新夹具需要明确版本、来源及校验清单。源文件与同版本快照一致性由 pkg 校验。

```sh
node scripts/check-platform-fixtures.mjs
pkg check -install=false -packages fixtures/platform/packages
pkg check -install=false -packages fixtures/platform/test-packages
```

Platform 消费端应显式指定一个固定 Package 仓库提交（本地开发可用同级工作树），测试入口统一解析外部夹具根，CI 在执行前检出该固定提交并验证完整性。正式宿主不得默认加载测试夹具。迁移期间不要删除旧目录，直到 Platform 的消费者与回归都验证通过。历史作者态和制品沿用原来源权属；此迁移未对原 Platform 内容重新授予 Apache-2.0 许可，公开发布前由仓库维护者确认授权。
