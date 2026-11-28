# Accounting

定位：在真实法人、期间、总账权威接通前准备单币种科目和借贷凭证草稿。book是准备账簿范围，不是公司主数据。account固定账簿、科目编码、根类别与分组上级；journal及journalline拥有草稿状态、独立明细和汇总。reader查询，clerk草稿操作，manager科目维护及草稿操作。注意力：科目表与凭证页已接实际对象，其余入口保留明确占位。禁止正式过账、应付余额、税务与付款事实；不能以借贷平衡代替会计验收。

来源 Account、Journal Entry、Journal Entry Account，固定ERPNext源码提交及锚点见 docs/erpnext/evidence.json。W2-016 44/44，科目父级及编码、单币种同账簿、单边正数两位小数、修订作废与汇总、权限及取消。先决缺口：法人绑定、会计期间、货币精度、账户类型/默认科目、合法往来及财务事实、过账与冲销。

## W2-017/018 会计期间与到货准备

月度期间以 book/year/month 唯一，草稿关联必须同账簿同月且开放；主管关闭/重开，关闭后关联草稿禁止取消和明细创建/修订/作废。32/32；原44步凭证回归通过。未绑定期间的旧草稿仍允许操作（嵌套可选期间缺失值经 coalesce 处理），正式过账前必须解决期间强制绑定、缺失引用、法人、财年及迁移。不声称正式结账。

Inventory 新增 receipt/receiptline 两对象及 cancelintake/reviseintake/voidintake 三动作。订单号及行号仅未核验文本，基本单位拟接收/拒收量和位置匹配且分离、草稿内唯一来源行，取消/作废受控；35/35，三个位置实存/可用余额始终保持20/0/0。11条收货来源声明部分映射，不代表已批准采购来源、实际质检、收货或入库。原 Purchase Receipt 菜单转为明确标记的到货准备草稿，增加明细入口；原财年菜单仍占位，月度期间为附加入口。

现有 Platform pin 中，sugar.go:237–241,285–312 将 request 编译为协议请求；request_answers.go:55–94 有提供者幂等键、拒绝结果及可选回复；txn_calls.go:22–30 是查询读取，不是任意跨包写入。尚未验证ERP实际绑定、授权与补偿。隔离副本直接尝试 sum(lines, if(item.material.state = active,0,1)) 编译失败 item.material.state is used outside an aggregate；原派生审批 IB-ERP-0007 未解决，仍失败关闭。下一轮优先验证事务迭代逐行实时校验替代方案，不新增虚假过账。
