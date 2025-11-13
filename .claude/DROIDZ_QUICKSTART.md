# Droidz Quick Start Guide

Welcome to Droidz - your Claude Code superpower for parallel, spec-driven development!

## What is Droidz?

Droidz transforms Claude Code into a parallel development powerhouse by:

- **Spec-driven workflows** - Start with clear specifications, end with quality code
- **Parallel execution** - Run 3-5 tasks simultaneously using git worktrees
- **Specialist agents** - 7 specialized agents for different types of work
- **Supervised orchestration** - Approval gates ensure you stay in control
- **Memory persistence** - Remembers your decisions and patterns across sessions

## Quick Start

### 1. Create a Specification

```bash
/create-spec feature user-notifications
```

This creates a template at `.claude/specs/active/user-notifications.md`. Fill it out with:
- Overview and goals
- Requirements (functional, technical, security)
- Implementation plan broken into phases
- Dependencies and success criteria

**See example:** `.claude/specs/examples/user-profile-feature.md`

### 2. Validate Your Spec

```bash
/validate-spec .claude/specs/active/user-notifications.md
```

Checks for:
- Required sections present
- Clear acceptance criteria
- Realistic implementation plan
- Identified dependencies

### 3. Convert to Tasks

```bash
/spec-to-tasks .claude/specs/active/user-notifications.md
```

Generates an orchestration-ready JSON file with:
- Individual tasks with dependencies
- Assigned specialists
- Test strategies
- Acceptance criteria

### 4. Run Orchestration

```bash
/orchestrate file:user-notifications-tasks.json
```

Droidz will:
1. Create isolated git worktrees for each task
2. Spawn tmux sessions for specialists
3. Execute tasks in parallel (respecting dependencies)
4. Track progress and coordinate work
5. Merge results back to your main branch

## Available Commands

| Command | Purpose |
|---------|---------|
| `/create-spec [type] [name]` | Create new specification from template |
| `/validate-spec [file]` | Validate specification completeness |
| `/spec-to-tasks [file]` | Convert spec to orchestration tasks |
| `/orchestrate [source]` | Start parallel execution |
| `/orchestrate list` | Show active orchestrations |
| `/orchestrate cleanup [id]` | Clean up orchestration resources |

## Specialist Agents

Droidz includes 7 specialized agents:

1. **droidz-codegen** - Feature implementation with comprehensive tests
2. **droidz-test** - Test writing and fixing, ensuring coverage
3. **droidz-refactor** - Code cleanup and structural improvements
4. **droidz-integration** - External service and API integration
5. **droidz-infra** - CI/CD, build tooling, deployment configs
6. **droidz-generalist** - Safe fallback for miscellaneous tasks
7. **droidz-orchestrator** - Coordinates and manages parallel work

## Orchestration Modes

### File-based
```bash
/orchestrate file:tasks.json
```
Execute tasks from a JSON file.

### Spec-based
```bash
/orchestrate spec:.claude/specs/active/feature.md
```
Auto-convert spec to tasks and execute.

### Linear-based
```bash
/orchestrate linear:ENG-123
```
Fetch issue from Linear and execute.

### List mode
```bash
/orchestrate list
```
Show all active orchestrations with status.

### Cleanup
```bash
/orchestrate cleanup orchestration-abc123
```
Clean up worktrees and resources for completed work.

## Example Workflow

Let's add a user profile feature:

```bash
# 1. Create the spec
/create-spec feature user-profile

# 2. Edit the spec in .claude/specs/active/user-profile.md
# (Fill in requirements, design, implementation plan)

# 3. Validate it
/validate-spec .claude/specs/active/user-profile.md

# 4. Convert to tasks
/spec-to-tasks .claude/specs/active/user-profile.md

# 5. Review the tasks JSON, then orchestrate
/orchestrate file:user-profile-tasks.json

# 6. Droidz creates worktrees and runs tasks in parallel
# Tasks complete: db-migration, api-routes, ui-components, tests

# 7. Review and approve merges
# Each specialist reports back for approval

# 8. Clean up when done
/orchestrate cleanup orchestration-[id]
```

## Project Structure

```
.claude/
├── memory/
│   ├── org/              # Organization-wide memory
│   │   ├── tech-stack.json
│   │   └── decisions.json
│   └── user/             # User preferences
│       └── preferences.json
├── specs/
│   ├── active/           # Current specifications
│   ├── archive/          # Completed specs
│   └── examples/         # Example specs
├── scripts/
│   └── orchestrator.sh   # Main orchestration engine
└── commands/
    ├── create-spec.md
    ├── validate-spec.md
    ├── spec-to-tasks.md
    └── orchestrate.md

.runs/
└── .coordination/        # Active orchestration state
```

## Tech Stack Detected

Your project uses:
- **Framework:** Next.js 15.6 (canary) + React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth
- **AI:** Vercel AI SDK (multi-provider)
- **Package Manager:** pnpm
- **Build Tool:** Turbopack
- **Testing:** Node.js native test runner (tsx)

## Best Practices

### Writing Good Specs

1. **Be specific** - Clear requirements prevent ambiguity
2. **Break down work** - Smaller phases = easier parallel execution
3. **Identify dependencies** - Help orchestrator schedule tasks correctly
4. **Define success** - Clear acceptance criteria ensure quality
5. **Consider risks** - Anticipate problems before they happen

### Task Breakdown

Good task characteristics:
- Independent (minimal dependencies)
- Focused (single responsibility)
- Testable (clear verification strategy)
- Sized right (30min - 2h each)

### Orchestration Tips

- Start with 3-5 parallel tasks max
- Use approval gates for critical changes
- Review specialist reports before merging
- Keep worktree names descriptive
- Clean up completed orchestrations

## Troubleshooting

### "Git worktree already exists"
```bash
# List worktrees
git worktree list

# Remove stuck worktree
git worktree remove path/to/worktree --force
```

### "Tmux session not found"
```bash
# List sessions
tmux ls

# Kill stuck session
tmux kill-session -t session-name
```

### "Orchestration stuck"
```bash
# Check coordination state
cat .runs/.coordination/orchestration-[id].json

# Force cleanup
/orchestrate cleanup [id]
```

## Next Steps

1. **Read the example spec:** `.claude/specs/examples/user-profile-feature.md`
2. **Review the tasks:** `.claude/specs/examples/user-profile-tasks.json`
3. **Create your first spec:** `/create-spec feature [your-feature]`
4. **Join the workflow:** Start shipping features faster!

## Getting Help

- **Examples:** `.claude/specs/examples/`
- **Command docs:** `.claude/commands/`
- **Skills:** Check available skills with the Skill tool
- **Memory:** Review `.claude/memory/` for project context

---

**Pro Tip:** Droidz works best when you invest time in good specifications upfront. A clear spec enables fast, parallel execution with minimal back-and-forth.

Happy building! 🚀
