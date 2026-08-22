---
name: handoff
description: Create a fresh Codex task in the exact current worktree when the user explicitly requests a task handoff, preserving any supplied title or model settings.
---

# Same-Worktree Handoff

Use only when the user explicitly asks to create or hand off a task. The child runs in the exact
current checkout; the parent does not perform the handed-off work.

## Create the task

1. Preserve a supplied title exactly. If none is supplied, omit `title` and let task creation use
   its default; do not ask for or derive one.
2. Preserve any explicit model and reasoning choices. If either is not supplied, omit its field so
   task creation uses the selected default. Resolve an unambiguous short model name
   against the models advertised by `codex_app__create_thread` (for example, `sol` to the unique
   available `*-sol` model ID). Model and reasoning are separate fields: never substitute one for
   the other. If a requested value is unavailable or ambiguous, ask instead of silently changing it.
3. Call `codex_app__list_projects`, select the Git project whose path is the current repository,
   then call `codex_app__create_thread` with:

   - the exact title only when supplied;
   - target type `project` and the selected project ID;
   - `environment: { type: "local" }`.

   Do not use `environment: { type: "worktree" }`: that creates a separate checkout, including when
   `startingState` is `working-tree`. If local execution in the selected directory is unavailable,
   stop and report it.
4. Give the child the task, relevant decisions and constraints, and instructions to inspect the
   repository and working tree, preserve unrelated changes, use the appropriate workflow, verify
   its work, and report blockers. Tell it not to create another handoff or archive anything unless
   requested.

## Report

If creation returns a `threadId`, call `codex_app__wait_threads` with `timeoutMs: 0`, then emit
`::created-thread{threadId="<thread-id>"}`. If it returns only a `clientThreadId`, report that the
task is queued and do not pass that ID to thread tools. Include the title, task summary, repository
path, and that the exact working tree is shared. Omit the title from the report when task creation
used its default and did not return one.
