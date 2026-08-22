---
name: link-current-session
description: Link every imported Codex session whose title contains a supplied Linear issue identifier to that issue in AI Task Observer.
---

# Link matching sessions

Take the Linear issue identifier from the user's request. Ask for it only when it is missing or
ambiguous.

Find every Codex session whose title contains that exact identifier. Match case-insensitively, but
do not match a longer issue identifier such as `ABC-1234` when linking `ABC-123`.

Link each matching session to the supplied issue through AI Task Observer. Report the number linked
or already linked and identify any sessions that failed.
