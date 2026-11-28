# ERP 研发飞轮执行协议

参考 Craft Anything 3e59a9c368d8767810b4a4a09764c924810aa45b 的 skill.md、rebuild/mod.rs、workspace/progress.rs、evidence/unknown.rs。此处使用自己的包契约，不引入其运行时。

每轮选择一个可交付、可证伪的业务切片：
1. Study：固定源提交，阅读实际规则及反例；区分 observed / derived / inferred，记录证据路径、符号、范围和限制。先写待验证预测，不重复无收益搜索。
2. Design：明确唯一业务权威、对象/动作/关系/状态、权限、不变量、依赖，列出未解决问题；只有证实的平台能力不足进入 platform/inner-box。
3. Build：按现有包格式独立编写。未完成包 stage=test，不进入可安装发布目录；禁止复制 GPL 定义或实现。
4. Check：外部 pkg lock/check/try、确定性构建、角色负例、浏览器及跨包/并发/恢复用例。记录实际命令、工具版本、输入、结果。失败与工具不可用分开。
5. Refine：仅对真实可修复差异修改；同一切片默认最多六轮修正，连续两轮无证据/实现/验收进展停下记录阻塞，不以改写文档字节冒充进展。检查基础设施出错可重试一次，仍失败标未验收。重要不变量不可降级。
6. Checkpoint：每轮保存当前切片、完成与未完成门禁、来源证据、未知及下一步；新会话从 checkpoint.json 恢复，不从头研究。未完成验收不得标 released 或 verified。
7. Release：仅当强制门禁全过，封面、中文、catalog、依赖和真实发行流程符合仓库规范后发布。对未发布候选不写虚假 catalog URL。

长任务外层按 plan.md 波次推进；控制器为通用 PackageLoop，参见 ../package-loop.md；本项目配置 loop/projects/erpnext.json。运行状态独立于研究 checkpoint，冻结门禁与验收以控制器记录为准。

执行主体限定为当前对话研究者；PackageLoop 不启动模型。每一研究项完成即持久化证据，再执行控制器验收。

关键拒绝验收：任务可声明 probeRefusals，冻结 step/action/code/message（精确匹配输出）；pkg try 返回0仍须满足断言。错误码或拒绝原因不同即失败，不生成成功回执。不要为正常正例增加拒绝断言。
