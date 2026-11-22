# 源格式

一个包一个目录，YAML，一个资源一个文件。`pkg` 把它打成运行时制品（一个 JSON，作者不用打开）。

```text
packages/crm/
├── package.yaml            清单
├── package.lock.json       生成，提交；不手改
├── README.md  CHANGELOG.md  LICENSE
├── setup.yaml              可选：安装后的初始化步骤与角色要求
├── docs/guide.md           可选：包的使用说明，随制品带给租户
├── objects/<对象>/
│   ├── object.yaml
│   ├── page.yaml           可选：与对象同名的页面
│   └── actions/<动词>.yaml  以这个对象为目标的动作
├── applications/<应用>.yaml
├── flows/  pages/  actions/  queries/  functions/  agents/
├── integrations/{connections,sources,listeners,writebacks,datasets,matching,observations,...}/
└── tests/{sample-sets,test-plans,evaluations}/
```

## package.yaml

| 字段 | 说明 |
|---|---|
| `id` | 包的标识，如 `crm`。发布后不改 |
| `version` | 语义版本，见 [版本规则](versioning.md) |
| `namespace` | 包内名字的前缀 |
| `title`、`description` | 市场里显示的标题与简介（英文原文；译文写在应用的 `languages`） |
| `requires` | 可选：依赖的其他包与版本范围，如 `manufacturing.core@^1.0.0` |
| `roots` | 安装时的根资源，一般是应用：`{app: build, kind: app, name: crm}` |
| `artifact` | 制品文件名，也是 Release 里的资产名 |

## 资源

- 资源的种类由所在目录决定；名字取文件里的 `name`。对象的完整名是 `namespace.name`，动作取 `schema`。源里不写引用标识。
- 不写依赖、能力、动作输入模式与模式版本：`pkg` 用宿主的同一实现算出，写进制品。源里出现 `schemaVersions` 会被拒。
- 不在已知位置的 `.yaml` 会被拒，避免写错目录的文件被悄悄忽略。

## package.lock.json

`pkg lock` 生成，CI 核对它没有过期。它记下每个资源的摘要、契约版本，以及每个对象的模式版本历史：
对象的模式一变就追加一条；与上一版不兼容（删字段、改类型、加必填）时升一个族，平台据此拒绝不兼容的升级。
