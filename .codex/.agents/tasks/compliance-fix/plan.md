# Goal

Ensure the local skill and agent definitions comply with the repo rule that subagents must not spawn or delegate to other subagents.

# Scope

Update only the identified skill and agent prompt files that currently instruct a subagent to delegate work to another subagent.

# Non-goals

Do not change unrelated skills, agents, runtime behavior, or enforcement mechanisms.
Do not implement broader refactors beyond the minimal wording changes needed for compliance.

# Constraints

Only the main agent may delegate to subagents.
Subagents must report results or boundaries back to the main agent instead of spawning or routing to other subagents.
Keep edits minimal and limited to the approved compliance fix.

# Plan

1. Update the conflicting skill and prompt text so only the main agent may delegate.
2. Rewrite subagent prompts so they report back instead of routing work to another subagent.
3. Re-scan the edited files for remaining delegation language and summarize the final compliance state.

# Risks

Some wording may describe conceptual handoffs rather than literal spawning, so changes should preserve intent while removing conflicting delegation instructions.
Other prompt-like files outside the audited set may still contain similar language and are out of scope unless found during verification.

# Tests

Review the edited files to confirm they no longer instruct subagents to delegate to other subagents.
Search the targeted files for delegation language after the edits and confirm the remaining wording is compliant with AGENTS.md.
