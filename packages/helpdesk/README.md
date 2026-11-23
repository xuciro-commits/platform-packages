# Helpdesk

Customer support and after-sales ticketing for Platform.

## What is included

- **Tickets (`helpdesk.ticket`)**: Dual response and resolution SLAs, stage Kanban board (`New`, `In progress`, `Waiting on customer`, `Escalated`), balanced auto-assignment, structured reply/escalation/resolution/close/reopen actions, and CSAT tracking.
- **Replies (`helpdesk.reply`)**: Public customer replies and internal agent notes linked to each ticket.
- **Knowledge base (`helpdesk.article`) & Canned replies (`helpdesk.cannedreply`)**: Reusable troubleshooting articles (Draft → Published → Archived) and standard response templates.
- **Customers (`helpdesk.customer`) & Contacts (`helpdesk.requester`)**: Customer tiers with automatic open and total ticket rollups.
- **Settings**: Consolidated supervisor settings page for stages, priorities, queues, categories, channels, and resolution reasons.

## Roles

- `agent`: Works tickets in their unit, replies, escalates, resolves, and contributes to customers, knowledge articles, and reply templates.
- `supervisor`: Full visibility across all queues, archives records, publishes knowledge articles, and manages all settings dictionaries.

See [DESIGN.md](DESIGN.md) for the full design rationale and trade-offs.

市场展示封面：[`assets/cover.avif`](assets/cover.avif)，仅为静态库资源，不包含在运行时制品中。
