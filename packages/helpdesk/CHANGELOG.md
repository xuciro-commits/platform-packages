# Changelog

## 0.2.0

- Customers and contacts now come from Business partners (`party` 0.2, required): a customer is the support side of a `party.organization`, attached to it one-to-one, and a ticket's contact is a `party.contact`. The organization's name, website, contacts and addresses are kept once and shared with other applications.
- Removed `helpdesk.requester`; removed the customer's own name and domain fields (they live on the organization). The customer name shown in lists is carried from the organization.
- Demo data creates its organizations and contacts in Business partners.
- Breaking for preview tenants that hold 0.1.x data: the upgrade is refused; uninstall 0.1.x and install 0.2.0.

## 0.1.1

- Added out-of-the-box demo seed data (`seed.yaml`) covering sample customers, requesters, knowledge articles, canned replies, multi-stage tickets, and replies, with one-click demo data cleanup support.

## 0.1.0

- Initial preview release: tickets with dual response/resolution SLAs, stage Kanban board, balanced assignment, replies/internal notes, escalation, structured resolution with CSAT, knowledge base, canned replies, customer/contact rollups, supervisor settings page, dashboard, and Simplified Chinese (`zh-CN`) localization.
