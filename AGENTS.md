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

## Single Branch Rule

For now, Claude and Codex should both work on `grid-rebuild-codex`.

Do not create, switch to, or push separate Claude/Codex task branches unless the user explicitly asks for branch splitting again.

Before editing:

1. Run `git status --short --branch`.
2. Confirm the branch is `grid-rebuild-codex`.
3. Pull or fetch the latest remote state if needed.
4. Read the latest entries in `AGENT_CHANGELOG.md`.

If another branch contains useful work, do not merge it silently. Document what exists and ask the user before merging or deleting branches.
