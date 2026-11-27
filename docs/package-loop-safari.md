# PackageLoop Safari Bridge

A user-confirmed, local transport adapter for existing ordinary Chat conversations. Uses macOS AppleScript / Safari DOM only, no extra model, no Work, no Codex, no persistent service. It does not automatically submit prompts, scrape replies, access account data, or bypass usage limits.

## Protocol

- `test`: prepare exactly one test event, target must be an exact ChatGPT conversation URL.
- `prepare`: derive a task event from stable `awaiting_work` state and semantic fingerprint. The prompt contains only event identity, task, and local evidence path.
- `draft`: opens exact target, checks URL again, preserves nonempty composer and inserts only the event text. User sends manually. Bounded readiness checks; no autonomous retry loop.
- `ack`: explicit receipt via platform-shell by the recipient conversation, idempotent. It confirms delivery to the assistant only, not acceptance of work. No output scraping.
- `status`: read local ledger; `cancel`: explicit cancellation, does not clear browser text.
- One unresolved event per project; identical semantic event deduplicated; a crash during drafting requires manual inspection. Never re-send on unknown outcome.

Local runtime ledger is `.package-loop/<project>/safari-bridge.json` (ignored). Target URL and task identity are not committed. Run the independent verifier for any actual package completion.

## First test

From the package repo, prepare a test using `node scripts/package-loop-safari.mjs test --project erpnext --target <exact conversation URL>`; use the returned event id with `draft --project erpnext --event <id>`. The user sends the draft. The recipient can record the explicit ACK using the command in the message. Test passes only after ACK; successful drafting is transport-stage evidence only.

`node --test scripts/package-loop-safari.test.mjs` tests exact target, deduplication, receipt, preservation of existing draft and no submission on a simulated DOM. Real Safari integration is a separate check.

## Explicit automatic handoff (opt-in)

The original manual bridge remains the default. The separate package-loop-handoff.mjs can arm an exact acknowledged event in test mode (one follow-up, ACK only) or ERP mode (1–20 turns, default 6, total wall-clock authorization 2 hours). Finish must be the last tool call before final response; there is no native post-response callback. A one-shot macOS user LaunchAgent performs the independent controller run in ERP mode, waits at least 8 seconds then for three idle checks, drafts the exact event and invokes safari-chat-once.mjs send once. It preserves existing composer text, fails closed on wrong target, stopped state, no semantic progress, review-required gate or unknown send outcome. No automatic retry of a click; ACK is definitive. No restart at login or on failure. The adapter checks visible UI controls, not hidden response APIs, and cannot guarantee that an idle UI is proof of response completion. A manual interruption may require inspecting the ledger.

    node scripts/package-loop-handoff.mjs arm --project erpnext --mode test --event ACKNOWLEDGED_EVENT_ID
    node scripts/package-loop-handoff.mjs finish --project erpnext --event ACKNOWLEDGED_EVENT_ID
    node scripts/package-loop-handoff.mjs status --project erpnext
    node scripts/package-loop-handoff.mjs stop --project erpnext

Only after successful one-shot delivery and ACK, explicitly arm ERP mode with a bounded budget. The stop command prevents future handoff, cannot retract an already submitted message; a running independent verifier can be stopped using package-loop.mjs stop. Do not use automated transport to bypass usage limits, approvals, or rate limits; stop when unavailable.

### Submission verification (revised)

The one-shot adapter records clickObserved, synthetic, buttonLabel, buttonTestId, clickedAt, submitted and verifiedAt separately. A cleared composer and busy indicator are not submission evidence. Only the exact normalized outgoing text in a rendered user-message bubble establishes submitted; ACK remains separate. The current Safari UI uses bg-user-message as a fallback to legacy author attributes. Submission confirmation polls read-only for up to eight seconds; never retries a click. Missing or uncertain evidence stops the handoff. A programmatic click is synthetic and does not prove that a concurrent manual action did not submit; integration tests require no manual send.

### Pin and watchdog

Multiple Safari tabs may share the same conversation URL. Both draft and send now use the same saved window ID, tab index and exact URL; no opening or selecting the first URL match. The handoff freezes this locator at arm time. If it changes, stop. The local worker has a bounded timer: wait 2.5 seconds and retry once only after a proven pre-click failure and exact matching unsubmitted draft; never retry after an observed or ambiguous click. Observe ACK for at most 45 seconds; timeout is not permission to resend. The worker does not make the current ChatGPT session independently callable.
