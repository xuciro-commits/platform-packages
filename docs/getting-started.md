# 十分钟做出第一个包

需要：Go（版本见平台的 `capabilities/server/go.mod`）、Node 22 以上、pnpm，以及一份平台源码。

## 1. 取得 pkg

`pkg` 是平台的打包工具，校验与依赖计算用的就是宿主自己的代码，所以本地报的错和装进租户时一样。

```bash
git clone https://github.com/xuciro-commits/platform.git
cd platform/capabilities/server
go build -o ~/bin/pkg ./cmd/pkg
```

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
```

在平台仓库里 `make frontend-host`，再 `pnpm --dir frontend dev`，打开 http://localhost:8496，用 `admin-1 · blank` 登录。
交付 → 市场 →「⋯ → 从地址或文件安装」，选 `/tmp/acme.json`：审阅页列出来源、摘要、应用与角色，确认后安装。
应用栏出现你的应用，打开列表就能新建记录。

## 5. 提 PR

写 `README.md` 与 `CHANGELOG.md`（`## 0.1.0` 一节），复制仓库根的 `LICENSE`，提 PR。CI 会再跑一遍 `pkg check`。
