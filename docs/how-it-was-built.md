# How Sunday Sort was built

Sunday Sort was planned with the Devpost Learn skill pack and built by Snap's CLAD agents in Lens Studio, driven from Claude Code through the Lens Studio MCP. This file records the workflow and the snags we hit along the way, since most of them will hit other builders too.

## 1. Plan: the `plan-lens` interview

- Skill pack: `npx skills add challengepost/learn-specs --all -y` (one skill, `plan-lens`).
- The interview went one question at a time through the idea, the spatial moment, what the preview has to fake, where everything sits, hands, when things show, and done criteria.
- Output: [`devpost/design-brief.md`](../devpost/design-brief.md), approved with `status: approved`.

Decisions the interview pushed on, and where they landed:

| Question | Decision |
|---|---|
| How does the Lens know which bottle is in your hand? | Pinch the bottle itself. It stands in for the camera reading the label, so there is no separate "Found it" button. |
| How do you finish a bottle with pill dust on your fingers? | One 8 cm Done button in a fixed spot. The 3 cm cells are display only, never targets. |
| What if the last bottle is out of view? | A chime from its direction and a small arrow, only once everything else is done. |
| Is the mid-week dose change in scope? | Yes, but built last and marked stretch, after fill and check pass their tests. |

## 2. Build: CLAD through the Lens Studio MCP

- CLAD plugin: `ls-clad@ls-extensions`, enabled for this project in [`.claude/settings.json`](../.claude/settings.json).
- Prompt, in a fresh session: *"Read devpost/design-brief.md and build it for SPECS. Follow the brief closely. Get the basic flow working first, then add detail. Write and run LEAF tests for each done criterion, and tell me which pass."*
- CLAD's `lens-studio-router` checked the project, the MCP connection and the sign-in, then handed off to the `specs-experience-builder` agent.
- Generated so far: three chimes with `build-sfx` (done, nudge, week ready) and Material icons for the buttons.

*(Build details and LEAF results are added below when the build finishes.)*

## 3. Snags worth knowing about

**Lens Studio 5.24 deletes the skill pack.** Its Agents-Docs plugin removes `.agents/` on every project load as a "legacy cleanup" (`[AgentsDocs] Removed legacy .agents/ directory` in the log). The skills installer puts `plan-lens` in `.agents/skills/` and only symlinks it from `.claude/skills/`, so the skill vanished the first time the project opened. Fix: keep the skill as real files in `.claude/skills/plan-lens`.

**Signing in on 5.24.1 failed, which blocks CLAD.** Lens Studio 5.24.1 signs in through the new Specs account page, which kept answering "Something went wrong". CLAD's router has a mandatory sign-in gate, so the build stopped with `not_signed_in`. The organizers' published fix worked: on Lens Studio **5.23.2** sign-in went through first time. Recreate the Base Template there rather than opening a 5.24.1 project in it: the older editor warns the project and its Spectacles packages come from a newer version.

**Claude Code can remember "no" for the MCP server.** If the prompt to use the project's `.mcp.json` server is dismissed, the `lens-studio` server silently disappears from `/mcp`. `claude mcp reset-project-choices`, then restart and choose "Use this and all future MCP servers in this project".

**Lens Studio adds Git LFS rules.** It writes a `.gitattributes` that routes everything in `Assets/` and `Packages/` through Git LFS. This repo leaves that file untracked and stores assets as ordinary files, so they stay readable on GitHub.

## 4. Tools

| Tool | Version |
|---|---|
| Lens Studio | 5.23.2 |
| Spectacles Interaction Kit, Spectacles UI Kit | as shipped with the 5.23.2 SPECS Base Template |
| Claude Code | 2.1 |
| CLAD (`ls-clad`) | 1.0.0 |
| Skill pack | `challengepost/learn-specs` (`plan-lens`) |
