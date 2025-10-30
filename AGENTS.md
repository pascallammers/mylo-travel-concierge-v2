# 🧠 AGENTS.md — Modular Development Workflow

---

## 🧩 Core Principles

All code must be modular. 
The mission of this workflow is to ensure **clarity, modularity, and reusability** across all codebases and ease of maintenance by strictly limiting file size..  
Agents must always act as disciplined contributors, not improvisers.

---

### 1. File Size & Structure

- **Limit:** Each file ≤ **600 lines** (ideal: 500–600).
- **SRP:** One file = one clear responsibility.
- **Barrel files:** Each feature folder must include an `index.ts` exporting its public API.
- **Documentation:**  
  Every public class/function requires JSDoc with `@param`, `@returns`, and a concise purpose line.
- **Dependency Injection:**  
  Never import internal dependencies inside the function — pass them as parameters.

---

### 2. Defensive Rules

- ❌ Never use `any`
- ❌ Never use dynamic imports like `await import()`
- ❌ No redundant `try/catch` or defensive guards unless the plan explicitly requires it

---

### 3. Testing Standards

- Every business logic file requires a `*.test.ts` alongside it.
- Tests must validate all public interfaces and critical branches.
- After implementation, run targeted tests using:
  ```bash
  npx tsx --test "<pattern>"
  ```
  and record outputs in the corresponding `/tasks/...` folder.

---

## ⚙️ Workflow Rules

All development occurs through a **Task-Based Workflow**, separated into **Frontend**, **Backend**, or **Full-Stack**.

---

### 🔖 0. Task Handling

#### General
- Tasks are stored under:
  - `tasks/frontend/DD-MM-YYYY/<task-id>/`
  - `tasks/backend/DD-MM-YYYY/<task-id>/`
- `<task-id>` must be a short **semantic slug** (e.g. `add-user-login`, `fix-modal-styling`).

#### Multiple tasks per day
- If you revisit a task on the same day, **append** to its existing folder instead of creating a new one.
- Mini tasks (quick fixes, variable rename, config change) can be logged in `tasks/_quicklog/DD-MM-YYYY.md`  
  with a short entry like:
  ```
  [10:42] fixed typo in useFetch hook
  [14:17] adjusted env var naming in supabase config
  ```

#### Task completion
Each task folder must include a `files-edited.md` listing:
```
File: /src/utils/dateFormatter.ts
Lines: 45–63
Summary: Added timezone normalization and tests
```

---

### 🧭 1. Research Phase

Goal: Understand context and patterns before coding.

- Investigate **existing implementations** in the codebase.
- Research external standards or libraries if relevant.
- Ask the user clarifying questions before proceeding.

Save findings as:
```
tasks/<type>/<date>/<task-id>/research-<task-id>.md
```

---

### 🧩 2. Planning Phase

After research, create a `plan-<task-id>.md` that includes:
- Overview of problem & context
- Architecture or data flow if relevant
- Steps for implementation
- API contracts, interfaces, or dependencies
- Risks or open questions

---

### 🔨 3. Implementation Phase

Follow the `plan.md` strictly.

- Create a **checklist** of implementation items and check them off.
- For database changes or schema migrations, use the **MCP Server**.
- Keep code modular and self-contained.
- Group questions at the end rather than interrupt flow.

---

### ✅ 4. Verification Phase

After implementation:
1. Run relevant test suites:
   ```bash
   npx tsx --test <pattern>
   ```
2. Record output in `/tasks/<type>/<date>/<task-id>/verification.md`
3. Confirm that all lint and type checks pass.

---

## 🧠 Debugging & Fixing Rules

When debugging:

1. Identify 5–7 potential root causes.
2. Narrow to 1–2 most likely hypotheses.
3. Add temporary log statements to confirm the diagnosis.
4. Ask the user to **confirm** the assumption before applying the fix.

---

## ⚡ Spec-Mode Exception (Factory.ai Droid Integration)

When the Agent detects **Spec-Mode (Factory.ai / Droid)**:
- **Skip file and folder creation** entirely (no `/tasks/...`).
- **Skip Research & Planning Phases.**
- Operate **inline only**, focusing on:
  - Code analysis  
  - Bug detection & refactor proposals  
  - Lightweight diff suggestions  
  - Unit test creation/adjustment
- No filesystem operations are permitted in Spec-Mode.
- Add a short summary comment at the end of the spec for context:
  ```md
  <!-- Spec-Mode: inline patch, no task folders created -->
  ```

This ensures Spec-Mode remains fast, self-contained, and compliant with Droid’s restrictions.

---

## 🧩 Philosophy

> “Move fast — but build precisely.”

Every commit or spec must:
- Contribute toward long-term maintainability.
- Be explainable by its task’s plan.md.
- Be verifiable through tests.

---

### Example Workflow Summary

| Phase | Output File | Example |
|--------|--------------|---------|
| Research | `research-fix-login-bug.md` | Notes & analysis of cause |
| Planning | `plan-fix-login-bug.md` | Step-by-step implementation plan |
| Implementation | `files-edited.md` | File paths + line ranges |
| Verification | `verification.md` | Test output logs |

---

### Example Quicklog Entry (for fast iterative dev)

File: `tasks/_quicklog/30-10-2025.md`
```
[09:12] Adjusted auth middleware for admin routes
[11:07] Fixed broken import in dashboard.tsx
[14:58] Refactored Supabase init to use env vars from config
```

---

### Closing Reminder

> **Discipline creates speed.**
> You don’t get faster by skipping steps — only by making them leaner and more consistent.
