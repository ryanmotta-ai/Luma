# REVIEW.md — Code Review Instructions for Claude Code

> **Purpose:** This document defines how Claude Code must conduct code reviews in this repository.
> It is a permanent instruction file. Whenever a review is requested, follow these rules exactly.

---

## 1. Ground Rules (Non-Negotiable)

When performing a review, Claude **MUST**:

- ✅ **Only review.** Produce a technical report and nothing else.
- ✅ Read files, search the codebase, and inspect git history as needed to support findings.
- ✅ Base every finding on code actually read — never on assumptions.

When performing a review, Claude **MUST NOT**:

- ❌ Edit, create, or delete any file (the report itself is delivered as chat output unless explicitly asked otherwise).
- ❌ Apply fixes, refactors, or "quick corrections" — even trivial ones.
- ❌ Create commits, branches, stashes, or modify git state in any way.
- ❌ Run commands that change system or project state.

If the user asks for a fix during a review, treat it as a **separate task requiring separate confirmation** — never fold fixes into the review itself.

---

## 2. Review Scope

Unless the user narrows the scope, review the code that is relevant to the request:

- **Diff review:** when reviewing recent changes, focus on the changed files, but follow their impact into the code they touch.
- **Full review:** when reviewing the project, cover all source code (HTML, CSS, JavaScript, SQL/migrations, config), skipping vendored/third-party code and generated artifacts.

---

## 3. Priority #1 — Standardization (Consistency Between Developers)

This project is developed by **two people**. Divergent personal styles are the single biggest long-term maintainability risk, so **detecting inconsistencies between patterns is the most important part of every review.**

> ⚠️ **Mindset:** The goal is **not** to declare one pattern "wrong" and the other "right".
> The goal is to **identify where the codebase diverges** and **recommend one convention to standardize on**, with a brief rationale (prefer the pattern that is more prevalent, safer, or simpler to maintain).

Actively look for divergences in:

| Area | What to compare |
|---|---|
| **Naming conventions** | camelCase vs snake_case, prefixes (`g`, `d`, `f`, `p`, `_`), abbreviations, Portuguese vs English identifiers, boolean naming (`is`/`has`), event handler naming |
| **Folder organization** | Where new modules land, per-feature vs per-layer grouping, misplaced files |
| **Component organization** | How UI blocks are structured, initialized, and wired to the DOM; inline `onclick` vs `addEventListener` |
| **Class structure** | Use (or absence) of classes, ordering of members, static vs instance patterns |
| **Function structure** | Size, parameter style (positional vs options object), early returns vs nesting, arrow vs `function` declarations |
| **Code style** | Indentation, quotes, semicolons, line density (compressed one-liners vs expanded blocks), template literals vs concatenation |
| **Different strategies for the same problem** | Two implementations of the same concern (e.g., two escaping helpers, two toast/notification paths, two ways to fetch the same data, duplicated modal logic) |
| **Error handling** | `try/catch` granularity, silent `catch(e){}` vs logged vs surfaced to user, error message tone and language |
| **Validation** | Where validation happens (input vs render vs persistence), duplicated validation rules, permissive vs strict defaults |
| **Import / dependency organization** | Script load order, globals vs explicit dependencies, where shared helpers live |
| **Code reuse** | Copy-pasted blocks that should share a helper, near-identical templates/renderers |
| **Architectural patterns** | State management approach, DOM-render strategies, separation between data access and UI, direct DB access patterns |

Every divergence found must appear both as an individual finding **and** in the consolidated **"Standardization"** section at the end of the report (see §6).

---

## 4. Full Review Checklist

Beyond standardization, evaluate the following dimensions. For each, report concrete findings — not generic advice.

### 4.1 Architecture
- Module boundaries and responsibilities; coupling between UI, state, and data access.
- Consistency with the project's established architecture (keep recommendations realistic for the current stack — do not propose framework rewrites).
- Global state usage, initialization order, and lifecycle of long-lived objects.

### 4.2 Clean Code
- Meaningful names, small focused functions, minimal side effects.
- Comments that explain *why*, not *what*; outdated or misleading comments.

### 4.3 SOLID
- Single Responsibility violations (god files / god functions).
- Rigid code that requires editing many places for one behavioral change.
- Leaky abstractions and implicit hidden dependencies between modules.

### 4.4 DRY
- Duplicated logic, duplicated constants, duplicated markup templates.
- Divergent copies (duplicates that have already started to drift apart — flag these as higher severity).

### 4.5 KISS
- Over-engineered solutions, unnecessary indirection, cleverness that hurts readability.
- Simpler alternatives that preserve behavior.

### 4.6 Performance
- Unnecessary re-renders / repeated full `innerHTML` rebuilds of large trees.
- Work inside loops that could be hoisted; repeated DOM queries; layout thrashing.
- Memory leaks: listeners never removed, timers never cleared, detached DOM references, growing caches.
- Unbounded data growth (localStorage, in-memory arrays, history).

### 4.7 Security
- **XSS:** any user- or database-sourced value interpolated into `innerHTML`, attributes, inline `onclick`, or `style` without escaping. Verify the established escaping helpers are used consistently.
- Injection into dynamically built code paths (string-built handlers, `eval`-like patterns).
- Authorization: client-side role gates that lack a server-side (RLS) counterpart; trust placed in client-only checks.
- Secrets or credentials in source; sensitive data in localStorage; overly permissive CORS/config.

### 4.8 Potential Bugs
- Null/undefined access, unchecked `getElementById` results, race conditions with async flows and timers.
- Incorrect assumptions about data shape; off-by-one and boundary math errors.
- State machines that can enter inconsistent states (partially reset state, stale caches).

### 4.9 Edge Cases
- Empty lists, missing optional fields, zero/negative numbers, very long strings.
- Slow or failed network requests; offline behavior; concurrent user actions.
- Locale issues (dates, number formatting, pt-BR strings).

### 4.10 Dead Code
- Unreferenced functions, unused variables, unreachable branches, commented-out blocks, orphaned CSS selectors and HTML ids.

### 4.11 Duplicated Code
- Structural duplication across files or modules (report together with DRY findings, but list file pairs explicitly).

### 4.12 Complexity
- Deep nesting, long parameter chains, functions doing many things, cyclomatic hotspots.

### 4.13 Readability & Maintainability
- Code a new contributor could not follow without help; magic numbers; implicit coupling via naming conventions or load order.

---

## 5. Severity Scale

Use exactly these levels:

| Severity | Meaning |
|---|---|
| 🔴 **Critical** | Security vulnerability, data loss, or a bug that breaks a core flow. Must be addressed immediately. |
| 🟠 **High** | Likely bug, significant performance problem, or divergence actively causing defects/drift. |
| 🟡 **Medium** | Maintainability risk, inconsistency, duplication, or edge case that will bite eventually. |
| 🔵 **Low** | Style, readability, minor cleanup, cosmetic inconsistency. |

Do not inflate severities. A report where everything is "Critical" is useless.

---

## 6. Required Report Format

The review output is a **single technical report** with the structure below.

### 6.1 Per-Finding Format

Every finding must follow this template:

```markdown
### [#ID] Short descriptive title

- **Category:** Standardization | Architecture | Clean Code | SOLID | DRY | KISS |
  Performance | Security | Bug | Edge Case | Dead Code | Duplication | Complexity | Readability
- **Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low
- **File:** `path/to/file.js`
- **Approximate line:** ~123 (or a range, e.g. ~123–150)
- **Explanation:** What the problem is, with a short code excerpt when it helps.
- **Impact:** What happens (or will happen) because of this — concrete, not theoretical.
- **Suggestion:** How to fix or standardize it. Describe the change; do NOT apply it.
```

Rules:
- Number findings sequentially (`#001`, `#002`, …) ordered by severity (Critical first).
- Group findings under category headings.
- Every finding must cite a real file and location that was actually read.
- For standardization findings, always show **both** divergent patterns side by side and state which one to adopt and why.

### 6.2 Report Closing Sections (Mandatory)

End every report with all of the following:

```markdown
## Overall Score

X / 10 — one paragraph justifying the score, weighing severity and volume of findings
against the size and maturity of the codebase.

## Key Strengths

- 3 to 7 bullet points highlighting what the codebase does well.
  (A fair review recognizes good decisions — this keeps reviews trusted and actionable.)

## Top 10 Issues

| # | Finding | Severity | File |
|---|---------|----------|------|
(The ten most impactful findings, linked by ID, ordered by priority to fix.)

## Prioritized Improvement Plan

1. **Now (this week):** Critical and quick High-severity fixes.
2. **Next (this month):** Remaining High items and structural Medium items.
3. **Later (backlog):** Medium/Low cleanups, dead code removal, style alignment.
(Each step lists finding IDs and estimates relative effort: S / M / L.)

## Standardization

A consolidated summary of ALL consistency divergences found, as a table:

| Topic | Pattern A (where) | Pattern B (where) | Recommended standard | Rationale |
|-------|-------------------|-------------------|----------------------|-----------|

Close with a short list of suggested team conventions to document (e.g., in CLAUDE.md
or a CONVENTIONS.md) so the two developers converge going forward.
```

---

## 7. Tone and Quality Bar

- Be **specific**: cite files, lines, and code. Vague findings ("improve error handling") are not acceptable.
- Be **fair**: distinguish "different but fine" from "divergent and harmful". Not every difference is a problem — only report divergences that cause real friction, and say why.
- Be **actionable**: every suggestion should be implementable by the team without further investigation.
- Be **honest**: if an area was not reviewed (out of scope, too large), say so explicitly in the report instead of implying full coverage.
- Write the report in the language the user is communicating in, unless asked otherwise.

---

*This file governs review behavior only. It grants no permission to modify code under any circumstance.*
