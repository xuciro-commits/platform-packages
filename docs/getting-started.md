# 十分钟做出第一个包

需要：[gh](https://cli.github.com/)（下载 Release）与 Node 22 以上（跑本仓库的检查脚本）。不需要 Go，也不需要平台源码。

## 1. 取得 pkg 与平台

`pkg` 是平台的打包工具，校验与依赖计算用的就是宿主自己的代码，所以本地报的错和装进租户时一样。
它和单体宿主一起随 [平台的 Release](https://github.com/xuciro-commits/platform/releases) 发布，不用拉源码编译。
用 `platform.lock` 里写的版本：

```bash
version=$(cat platform.lock)
os=$(uname -s | tr A-Z a-z); arch=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
gh release download "$version" --repo xuciro-commits/platform --pattern "pkg-$os-$arch" --pattern "platform-$os-$arch" --pattern SHA256SUMS
grep -E "  (pkg|platform)-$os-$arch$" SHA256SUMS | shasum -a 256 -c -
chmod +x "pkg-$os-$arch" "platform-$os-$arch"
mv "pkg-$os-$arch" ~/bin/pkg
```

Windows 用 `pkg-windows-amd64.exe` 与 `platform-windows-amd64.exe`。

## 2. 从模板开始

```bash
cp -r templates/app packages/acme
```

改 `packages/acme/package.yaml` 的 `id`、`namespace`、`title`，再把资源里的 `example` 全部换成你的命名空间。
命名空间是包内所有对象、动作、页面的前缀，安装后不可改。

## 3. 加一个字段，刷新锁文件

在 `objects/item/object.yaml` 的 `fields` 里加一行：

```yaml
  - name: due
    title: Due date
    type: date
```

```bash
pkg lock packages/acme     # 改了对象的模式就要跑；锁文件记下新的模式版本
pkg check packages/acme    # 与 CI 跑的是同一个检查
```

## 4. 在浏览器里装上

```bash
pkg build -o /tmp/acme.json packages/acme
./platform-$os-$arch -addr 127.0.0.1:8495 -admin admin
```

单体宿主内嵌了工作台。打开 http://127.0.0.1:8495，以 `admin` 登录。
交付 → 市场 →「⋯ → 从地址或文件安装」，选 `/tmp/acme.json`：审阅页列出来源、摘要、应用与角色，确认后安装。
应用栏出现你的应用，打开列表就能新建记录。

## 5. 提 PR

写 `README.md` 与 `CHANGELOG.md`（`## 0.1.0` 一节），复制仓库根的 `LICENSE`，提 PR。CI 会再跑一遍 `pkg check`。
