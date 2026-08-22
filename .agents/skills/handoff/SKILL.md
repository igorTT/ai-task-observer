---
name: handoff
description: Create a fresh Codex task in the current worktree with a preassigned title when the user explicitly requests a task handoff.
---

# Same-Worktree Handoff

Create a fresh Codex task in the current repository and working tree, give it the exact title
requested by the user, and pass it a focused prompt containing the task context.

Use this skill only after the user explicitly asks to hand off, start, or create a new task. It
creates the child task but does not perform the handed-off work in the calling task.

## Prepare the handoff

1. Identify the preassigned title and the task to perform. Preserve the user's title exactly,
   including prefixes such as `Apply:`. If the user asks for a handoff without providing a title,
   derive a concise title from an unambiguous request; otherwise ask for the title.
2. Carry forward the user's requirements, relevant findings and decisions, constraints, and any
   explicitly requested model or reasoning level. Do not add unrelated scope.
3. Before creating a project task, call `codex_app__list_projects` and select the project whose path
   is the current repository. Confirm that it is a Git repository.

## Create the same-worktree task

Use `codex_app__create_thread`, not a fork of the current task, with:

- target type `project`;
- the selected project ID;
- local environment;
- `startingState: { type: "working-tree" }`, so current uncommitted changes are visible;
- the exact preassigned title.

Pass through a model or reasoning setting only when the user explicitly requested it; otherwise
use the configured default.

The child prompt must include the task request and relevant context, and instruct the child to:

- inspect the repository instructions and current working tree before editing;
- complete the requested task using the appropriate workflow or skill;
- preserve unrelated user changes and follow generated-file and verification rules;
- run focused verification appropriate to the task and report what was checked;
- stop and report if blocked or if the request requires clarification or a planning revision;
- not create another handoff; and
- not archive changes or tasks unless that is explicitly part of the request.

## Confirm and report

After creation, use `codex_app__wait_threads` with `timeoutMs: 0` for an immediate status snapshot.
If a ready `threadId` is returned, report it with:

`::created-thread{threadId="<thread-id>"}`

If setup returns only a `clientThreadId`, report that the task is queued and do not pass it to
thread tools that require a ready `threadId`. Include the title, task summary, repository path,
and that the working tree is shared.

The parent task should not perform the handed-off work. Wait for a new user request before doing
additional work in the parent.
