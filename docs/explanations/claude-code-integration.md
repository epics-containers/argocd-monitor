# Claude Code Integration

This project is a showcase for integrating
[Claude Code](https://claude.com/claude-code) into a devcontainer-based
development workflow. The pattern is language-agnostic — it works the same
way for TypeScript (this project), Python
([robot-arm-sim](https://github.com/gilesknap/robot-arm-sim)), and Go
([dra-usbip-driver](https://github.com/DiamondLightSource/dra-usbip-driver)).

```{contents}
:local:
:depth: 2
```

## Design principle: autonomy through isolation

Claude Code is most productive when given broad permissions — freedom to
read, write, run tests, and push code without constant approval prompts.
But broad permissions are only safe inside a controlled environment. The
devcontainer provides that environment: a disposable, reproducible sandbox
where Claude can operate freely without risk to the host machine or
unrelated repositories.

This is the central trade-off:

> **More autonomy inside the container, strict enforcement that it runs
> nowhere else.**

## Configuration layers

Claude Code configuration lives in three layers, each with a different
scope and audience:

### `CLAUDE.md` — project instructions

Checked into the repo root. Loaded into every conversation, so it must be
concise (aim for under 50 lines). Contains:

- **Build commands** — how to lint, test, build, and run docs
- **Hard rules** — things that cause real damage if forgotten (e.g. "never
  push to main", "always run `just check` before committing")
- **Foot-guns** — silent failures, sync requirements, non-obvious gotchas
- **Conventions** — commit style, coding patterns (one line each)

Everything else belongs in skills (loaded on demand) or in documentation
(explored when needed). See the
[trim-claude-md pattern](#keeping-claude-md-lean) below.

### `.claude/settings.json` — permissions and hooks

Controls what Claude Code is allowed to do. The key sections:

**Permissions** grant broad access inside the devcontainer:

```json
{
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash(*)", "WebSearch", "WebFetch(*)"],
    "deny": [
      "Bash(git push --force *)",
      "Bash(git reset --hard*)",
      "Bash(ssh *)", "Bash(ssh-agent *)", "Bash(*ssh-agent*)",
      "Bash(scp *)", "Bash(rsync *)", "Bash(sftp *)"
    ]
  }
}
```

- **allow** — operations that proceed without asking. File operations and
  bash are safe inside the container.
- **deny** — operations that are blocked outright. These are "escape
  vectors" — commands that reach outside the container (SSH, SCP) or are
  destructive (force push, hard reset). The `ssh-agent` patterns prevent
  Claude from re-enabling agent forwarding after the devcontainer has
  blanked `SSH_AUTH_SOCK`. We use `deny` rather than `prompt` because the
  prompt dialog has an "always allow" option that is too easy to accept
  accidentally, which would permanently bypass the protection.

**Hooks** enforce the devcontainer requirement:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "if [ -z \"$REMOTE_CONTAINERS\" ]; then echo 'BLOCKED: ...'; exit 2; fi; if [ -n \"$SSH_AUTH_SOCK\" ]; then echo 'BLOCKED: ...'; exit 2; fi"
      }]
    }]
  }
}
```

The hook runs two checks on every prompt:

1. `$REMOTE_CONTAINERS` must be set — confirms we are inside a devcontainer.
   If absent, every prompt is blocked, preventing accidental use of the
   permissive settings on the host.
2. `$SSH_AUTH_SOCK` must be empty — confirms SSH agent forwarding is
   disabled. The devcontainer blanks this variable, but this check catches
   cases where it gets re-introduced (e.g. by a shell profile or a
   manually started agent).

### `.claude/skills/` — on-demand knowledge

Skills are markdown files that Claude loads only when relevant (based on
the `description` field). They keep detailed knowledge out of `CLAUDE.md`
while making it available when needed.

Good candidates for skills:

| Skill | When it triggers |
|-------|-----------------|
| `documentation` | Editing files under `docs/` |
| `ci-debug` | Investigating CI failures |
| `yaml` | Python code that reads/writes YAML |
| `memo` | Saving work state to persistent memory |

Skills should be **project-agnostic** where possible so they can be shared
across repositories via a copier template. Project-specific knowledge
belongs in `CLAUDE.md` or in the documentation.

(keeping-claude-md-lean)=
## Keeping CLAUDE.md lean

`CLAUDE.md` is loaded into every conversation turn. A long file wastes
tokens, slows responses, and dilutes critical instructions. The rule of
thumb:

- **Keep inline:** rules that cause damage if forgotten on any task
- **Move to skills:** stable knowledge only needed sometimes (architecture,
  integration patterns, detailed conventions)
- **Drop entirely:** anything discoverable by exploring the codebase
  (directory trees, file listings, config schemas)

## Credential isolation

The devcontainer isolates credentials from the host to limit the blast
radius of prompt injection attacks (malicious instructions hidden in
issues, web content, or repository files):

- **SSH agent forwarding disabled** — `SSH_AUTH_SOCK=""` prevents access
  to host SSH keys
- **Git credential helper blanked** on every container start — the
  `postStart.sh` script removes credential helpers and SSH URL rewrites
  that VS Code copies from the host gitconfig
- **Scoped GitHub PAT** — authentication uses a fine-grained token limited
  to specific repositories, stored in a per-repo container volume
- **Network escape vectors denied** — SSH, SCP, RSYNC are blocked outright
  even inside the container

See {doc}`project-conventions` for the full credential isolation setup,
devcontainer details, and volume persistence strategy.

## Cross-language conventions

The Claude Code integration pattern sits on top of a set of
language-agnostic project conventions — `just` as the task runner,
Conventional Commits, Sphinx + Diataxis docs, pre-commit hooks, and a
consistent GitHub Actions CI structure. These are documented separately
in {doc}`project-conventions`.

## Further reading

- {doc}`project-conventions` — shared tooling, devcontainer setup, and
  conventions across TypeScript, Python, and Go projects
- [Building a Robot Simulator with Claude](https://diamondlightsource.github.io/robot-arm-sim/main/explanations/building-with-claude.html)
  — detailed walkthrough of Claude Code on a Python project, including
  prompting principles and lessons learned
- [python-copier-template](https://github.com/DiamondLightSource/python-copier-template)
  — the upstream template this pattern extends
