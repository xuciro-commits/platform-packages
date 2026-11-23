# party：往来单位

各应用共用的公司外部组织与人员：客户、供应商、合作方，以及在那里工作的联系人。只存一份；
CRM、服务台、采购在它上面用 `extends` 挂自己的字段（客户关系、服务等级、供应商评级），不再各建一套客户与联系人。

## 里面有什么

| 对象 | 是什么 |
|---|---|
| `party.organization` 往来单位 | 名称、法定名称、税号（填了就不能重复）、行业、规模、上级单位、联系方式、地址（国家和地区、行政区划、街道、邮编）、联系人数 |
| `party.contact` 联系人 | 姓名、所在单位、职位、部门、邮箱、手机、电话、勿联系 |
| `party.industry` 行业 | 字典，随包带 20 个常用行业 |

查重：按名称匹配往来单位、按邮箱匹配联系人；别的应用新建单位或联系人时，平台用它们提示“已有这一条”。

## 角色

- 所有成员（`user`）都能读、新建、修改往来单位与联系人：它们是公共名录。
- `party: steward`（数据管理员）还能归档、维护行业字典。

## 应用怎样用它

```yaml
requires: [party@^0.1.0]
---
name: account
namespace: crm
extends: party.organization
fields:
  - {name: base, title: Organization, type: reference, ref: party.organization, required: true}
  - {name: relationship, title: Relationship, type: choice, choices: "prospect:Prospect,customer:Customer"}
```

一个往来单位在一个应用里至多一条附属记录，建后不能改挂。地址引用基础包 `geo` 的国家和地区与中国行政区划，装 party 时会一起装上 geo。设计取舍见 [DESIGN.md](DESIGN.md)。
