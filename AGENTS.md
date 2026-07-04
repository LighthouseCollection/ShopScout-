# ShopScout Agent Coordination

This repository is shared by Claude and Codex. Keep changes traceable and easy to review.

## Required Change Record

For every task, fix, review, cleanup, or refactor, append a record to `AGENT_CHANGELOG.md`.

Write the entry before handoff. If the work is committed, include the commit hash. If it is not committed yet, mark the entry as `Uncommitted` and update it after commit. For changelog-only commits, `This commit` is acceptable to avoid self-referential commit-hash churn.

Each entry should include:

- Date and time
- Agent
- Branch
- Commit or uncommitted status
- What changed
- Files touched
- Validation run
- Review status or next reviewer
- Follow-ups or risks

Do not store secrets, API keys, private customer data, or raw AI prompts in the change log.

## Review Contract

When one agent completes a task, the other agent reviews it. Review entries also belong in `AGENT_CHANGELOG.md` and should distinguish:

- Must-fix issues
- Suggestions
- Style preferences
- Approved items

Pushback is allowed. If the implementer disagrees with a review point, document the reason in the next changelog entry.
