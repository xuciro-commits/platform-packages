# platform-packages

[Platform](https://github.com/xuciro-commits/platform) 的官方产品包库。
行业应用（CRM、酒店、供热、制造……）不写进平台代码，而是做成这里的声明式产品包：对象、动作、页面、流程与角色。
租户从平台的市场安装、升级、卸载它们；包里没有可执行代码，安装也不授予任何数据或动作权限。

*The official package library for Platform. Each package is declarative (objects, actions, pages, flows, roles) and is installed from the marketplace.*

## 包

包按行业、能力与关键词分类（[分类与标签](docs/taxonomy.md)），在平台市场里按这些筛选。
官方包来自开放应用：读懂它的业务内容与产品设计，按平台的对象、动作、状态与角色重新设计，不逐一复刻。
每个版本都是 [Releases](https://github.com/xuciro-commits/platform-packages/releases) 里一个不可变的制品，tag 为 `<id>/v<version>`，附 `SHA256SUMS`。

## 开发

- [十分钟做出第一个包](docs/getting-started.md)
- [概念](docs/concepts.md) · [源格式](docs/format.md) · [版本规则](docs/versioning.md) · [测试](docs/testing.md)
- [发版](docs/release.md) · [自建包库](docs/own-library.md) · [评审清单](docs/review-checklist.md) · [分类与标签](docs/taxonomy.md)

新包从 [`templates/app`](templates/app) 开始。每个 PR 都由 CI 用 `platform.lock` 里那个平台发行版的 `pkg` 校验：源能打成平台接受的制品，锁文件没有过期，版本号没变时与已发布版本等价，两次构建字节相同。

## 仓库

```text
packages/<id>/    一个包一个目录：package.yaml、资源 YAML、README、CHANGELOG、LICENSE
templates/app/    新应用包的起点
docs/             开发文档
scripts/          CI 用的检查
platform.lock     本仓库对齐的平台发行版；CI 与本地都下载这个版本的 pkg
```

## 许可

本仓库自研的包以 [Apache-2.0](LICENSE) 发布，每个包目录带自己的 `LICENSE`。
从 GPL 授权的应用转换来的包不在这里，另在独立仓库按原许可发布。
