# geo：地点

各应用共用的国家和地区、中国行政区划。记地址的应用（往来单位、员工、仓库、门店）都引用这一份，不各存一套。

## 里面有什么

| 对象 | 是什么 | 条数 |
|---|---|---|
| `geo.country` 国家和地区 | 名称、ISO 3166-1 两位与三位字母代码、数字代码；记录 ID 就是两位代码（如 `CN`） | 249 |
| `geo.division` 行政区划 | 中国的省、地、县三级：名称、全称（如“北京市东城区”）、六位区划代码、级别、上级；记录 ID 就是区划代码 | 3209 |

国家名称装入时按租户语言写入（中文租户写中文名）。行政区划只有中文名。数据来源与许可见 [NOTICE.md](NOTICE.md)。

## 角色

- 所有成员（`user`）都能读。
- `geo: steward`（数据管理员）能增、改、归档，用来补新设的区划或改名。

## 应用怎样用它

```yaml
requires: [geo@^0.1.0]
fields:
  - {name: country, title: Country or region, type: reference, ref: geo.country}
  - {name: region, title: Region, type: reference, ref: geo.division}
  - {name: street, title: Street address, type: text}
```

地址指向知道的最低一级区划（通常是县级），省市从它的上级与全称得到，不另存。设计取舍见 [DESIGN.md](DESIGN.md)。
