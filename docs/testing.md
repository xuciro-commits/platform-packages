# 测试

每个 PR 的 CI（`.github/workflows/check.yml`）跑：

1. 布局：每个包有 `README.md`、`LICENSE`、`CHANGELOG.md`，版本有对应的一节，不低于已发布版本。
2. 下载每个包最新的 Release，核对 `SHA256SUMS`。
3. `pkg check`：打成制品并经平台校验；锁文件没有过期；版本号没变时与已发布版本等价。
4. 同一份源构建两次，制品字节相同。

本地跑同样的检查：

```bash
pkg check packages/<id>
node scripts/packages.mjs reproducible --pkg=$(command -v pkg) <id>
node scripts/packages.mjs layout <id>
```

行为（角色能看到什么、动作走到哪个状态）在平台里验收：用 [入门](getting-started.md) 第 4 步装进夹具宿主走一遍。
包可以带 `tests/test-plans`、`tests/sample-sets` 与 `tests/evaluations`，它们随包安装。
