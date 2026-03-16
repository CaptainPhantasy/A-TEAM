# A-TEAM (DASES) Pipeline — Complete Operations Guide

> Deterministic Agentic Software Engineering System (DASES)
> 8-agent quality-gated pipeline for building production-ready software
> This document enables any single LLM (no sub-agent capability required) or human operator to run the full pipeline.

---

## TABLE OF CONTENTS

1. [What the A-TEAM Is](#1-what-the-a-team-is)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Repository Structure](#4-repository-structure)
5. [Pipeline State Machine](#5-pipeline-state-machine)
6. [Agent Reference (All 9 Agents)](#6-agent-reference-all-9-agents)
7. [Quality Gates Reference](#7-quality-gates-reference)
8. [Step-by-Step Pipeline Execution](#8-step-by-step-pipeline-execution)
9. [Artifact Format Specifications](#9-artifact-format-specifications)
10. [Pipeline State JSON Schema](#10-pipeline-state-json-schema)
11. [Operating the Pipeline as a Single LLM](#11-operating-the-pipeline-as-a-single-llm)
12. [Human Operator Deployment Guide](#12-human-operator-deployment-guide)
13. [Troubleshooting & Recovery](#13-troubleshooting--recovery)
14. [Best Practices](#14-best-practices)

---

## 1. WHAT THE A-TEAM IS

The A-Team is a deterministic, sequential, quality-gated multi-agent pipeline that takes raw user requirements and produces fully tested, documented, production-ready software. It consists of 9 agents (numbered 0-8), each with a specific role, deterministic prompt, required outputs, and quality gate that must pass before the pipeline advances.

**Core principle:** Each agent reads the artifacts produced by previous agents and produces its own artifact. The Critic (Agent 8) verifies every artifact against its quality gate. Nothing advances without a signed verification receipt.

**What it produces:**
- A complete specification document
- A technical review with all blockers resolved
- A project scaffold with locked dependencies
- A database/data architecture
- A fully implemented application
- A polished, accessible UI
- Complete documentation
- Verification receipts for every stage
- A final release sign-off

---

## 2. ARCHITECTURE OVERVIEW

```
User Requirements
  │
  ▼
Agent 0: Master Controller (Orchestrator)
  │
  ▼
Agent 1: Deep Planner (Requirements) ──── Quality Gate 1 ──── Agent 8: Critic
  │                                                              │
  ▼                                                              │
Agent 2: Deep Thinker (Technical Review) ── Quality Gate 2 ──── │
  │                                                              │
  ▼                                                              │
Agent 3: Scaffolding Expert (Build Setup) ── Quality Gate 3 ─── │
  │                                                              │
  ▼                                                              │
Agent 4: Database Specialist (Data Layer) ── Quality Gate 4 ─── │
  │                                                              │
  ▼                                                              │
Agent 5: Coding Expert (Implementation) ── Quality Gate 5 ───── │
  │                                                              │
  ▼                                                              │
Agent 6: Frontend Designer (UI/UX) ──────── Quality Gate 6 ─── │
  │                                                              │
  ▼                                                              │
Agent 7: Release Documentarian (Docs) ──── Quality Gate 7 ───── │
  │                                                              │
  ▼                                                              │
PRODUCTION RELEASE
```

**Key properties:**
- **Sequential:** Agents execute in order 1→2→3→4→5→6→7. No parallelism.
- **Quality-gated:** Agent 8 (Critic) verifies every agent's output before the next agent starts.
- **Deterministic:** Each agent follows a fixed protocol. Same inputs → same process.
- **Iterative on failure:** If a gate fails, the pipeline returns to the failing agent for fixes, then re-verifies from scratch.

---

## 3. PREREQUISITES

| Requirement | Purpose |
|-------------|---------|
| Claude Code CLI (or any Claude interface with agent support) | Hosts the agent definitions and orchestrates execution |
| The A-TEAM repository cloned locally | Contains agent definitions, pipeline state, and artifact directories |
| A clear project idea with as much detail as possible | Input for Agent 1 |

**No other dependencies.** The pipeline itself is pure prompt engineering — the agents are markdown files that define behavior. The actual technology stack is determined by the project being built.

---

## 4. REPOSITORY STRUCTURE

```
A-TEAM/
├── .claude/
│   ├── agents/
│   │   ├── 00-master-controller.md    # Agent 0: Pipeline orchestrator
│   │   ├── 01-deep-planner.md         # Agent 1: Requirements architect
│   │   ├── 02-deep-thinker.md         # Agent 2: Technical reviewer
│   │   ├── 03-scaffolding-expert.md   # Agent 3: Build engineer
│   │   ├── 04-database-specialist.md  # Agent 4: Data architect
│   │   ├── 05-coding-expert.md        # Agent 5: Principal engineer
│   │   ├── 06-frontend-designer.md    # Agent 6: UI/UX engineer
│   │   ├── 07-release-documentarian.md # Agent 7: Technical writer
│   │   └── 08-the-critic.md           # Agent 8: QA engineer
│   └── settings.json                  # Claude Code project settings
├── pipeline/
│   ├── state/
│   │   └── pipeline-state.json        # Current pipeline state
│   ├── artifacts/                     # Agent outputs saved here
│   │   ├── SPEC.md                    # Agent 1 output
│   │   ├── TECHNICAL-REVIEW.md        # Agent 2 output
│   │   ├── SCAFFOLDING-MANIFEST.md    # Agent 3 output
│   │   ├── DATABASE-ARCHITECTURE.md   # Agent 4 output
│   │   ├── IMPLEMENTATION-REPORT.md   # Agent 5 output
│   │   ├── FRONTEND-REPORT.md         # Agent 6 output
│   │   └── DOCUMENTATION-REPORT.md    # Agent 7 output
│   └── receipts/                      # Critic verification receipts
│       └── FINAL-VERIFICATION.md
├── docs/                              # Project documentation
├── output/                            # Final deliverable(s)
├── FLOYD.md                           # Boot contract for FLOYD protocol
└── .gitignore
```

---

## 5. PIPELINE STATE MACHINE

```
INIT
  │
  ▼
REQUIREMENTS (Agent 1 active)
  │ Gate 1 PASS
  ▼
TECHNICAL_REVIEW (Agent 2 active)
  │ Gate 2 PASS
  ▼
SCAFFOLDING (Agent 3 active)
  │ Gate 3 PASS
  ▼
DATABASE (Agent 4 active)
  │ Gate 4 PASS
  ▼
IMPLEMENTATION (Agent 5 active)
  │ Gate 5 PASS
  ▼
FRONTEND (Agent 6 active)
  │ Gate 6 PASS
  ▼
DOCUMENTATION (Agent 7 active)
  │ Gate 7 PASS
  ▼
RELEASE (Final sign-off)
  │
  ▼
COMPLETE
```

**On any gate FAILURE:**
```
Current State
  │ Gate FAIL
  ▼
Block report saved to pipeline/receipts/BLOCK-agent-X.md
  │
  ▼
Return to failing agent for fixes
  │
  ▼
Re-verify from scratch (Agent 8)
  │ Gate PASS
  ▼
Resume pipeline from next state
```

---

## 6. AGENT REFERENCE (ALL 9 AGENTS)

### Agent 0: Master Controller

**File:** `.claude/agents/00-master-controller.md`
**Role:** Pipeline orchestrator. Manages state, enforces quality gates, coordinates agent handoffs.
**Artifact:** `pipeline/state/pipeline-state.json`
**Commands:**
- `STATUS` — Show current pipeline state, active agent, gate statuses
- `HELP` — Explain the pipeline
- `REQUEST REVIEW: [Agent/Component]` — Force re-review
- `STOP PIPELINE` — Emergency halt, save state

**Responsibilities:**
1. Initialize pipeline: create directories, set state to INIT.
2. Execute agents in sequence 1→7.
3. After each agent: invoke Agent 8 (Critic) for verification.
4. On gate failure: block, save issue report, return to agent.
5. On gate pass: update state, advance to next agent.
6. After all gates pass: generate final release sign-off.

### Agent 1: Deep Planner (Requirements Architect)

**File:** `.claude/agents/01-deep-planner.md`
**Role:** Extract complete, unambiguous requirements through structured interrogation.
**Input:** User requirements (raw text, metaprompt, or conversation).
**Output:** `pipeline/artifacts/SPEC.md`
**Quality Gate 1:** Requirements Completeness.

**Deterministic Protocol:**
1. **Phase 1: Core Requirements Extraction** — Ask structured questions across 5 categories:
   - Functional Requirements (what the system does, user flows, data, edge cases)
   - Non-Functional Requirements (performance, scalability, security, accessibility)
   - Technical Constraints (integrations, preferred tech, budget)
   - Visual/UX Requirements (style, tone, brand, mood)
   - Success Criteria (metrics, 10/10 definition)
2. **Phase 2: Ambiguity Resolution** — For every requirement: identify ambiguity, propose interpretations, force user to choose, document choice.
3. **Phase 3: Specification Document** — Generate complete SPEC.md with: Executive Summary, User Personas, Functional Requirements (features with acceptance criteria, user flows, data model, API requirements, edge cases), Non-Functional Requirements, Technical Architecture, Visual & UX Specification, Success Criteria, Out of Scope, Assumptions.

**SPEC.md Mandatory Sections:**
```
1. Executive Summary
2. User Personas
3. Functional Requirements
   3.1 Core Features (each with acceptance criteria)
   3.2 User Interactions & Flows
   3.3 Data Model
   3.4 API Requirements
   3.5 Edge Cases & Error Handling
4. Non-Functional Requirements
   4.1 Performance
   4.2 Security
   4.3 Scalability
   4.4 Accessibility
5. Technical Architecture
   5.1 Technology Stack
   5.2 Project Structure
6. Visual & UX Specification
   6.1 Design Language
   6.2 Component Library
   6.3 Responsive Breakpoints
7. Success Criteria
8. Out of Scope
9. Assumptions
```

**Gate 1 Checklist:**
- [ ] All 5 phases completed
- [ ] SPEC.md has ZERO placeholders
- [ ] Every TODO/TBD resolved
- [ ] User confirmed specification accuracy
- [ ] No ambiguous requirements remain

### Agent 2: Deep Thinker (Technical Reviewer)

**File:** `.claude/agents/02-deep-thinker.md`
**Role:** Find all blockers, gaps, logical flaws, and missing information in the spec.
**Input:** `pipeline/artifacts/SPEC.md`
**Output:** `pipeline/artifacts/TECHNICAL-REVIEW.md`
**Quality Gate 2:** Blocker Clearance.

**Deterministic Protocol:**
1. **Phase 1: Logical Consistency** — For each requirement: does it make sense? Contradictions? Feasible? Hidden dependencies?
2. **Phase 2: Technical Feasibility** — Stack feasibility, integration feasibility, performance feasibility (back-of-envelope calculations).
3. **Phase 3: Gap Analysis** — Missing user stories, error handling, edge cases, security considerations.
4. **Phase 4: Blocker Classification:**
   - **Category A (BLOCKERS):** Must fix. Contradictions, impossible requirements, missing critical info.
   - **Category B (HIGH RISK):** Should clarify. Ambiguous requirements, risky choices, missing edge cases.
   - **Category C (RECOMMENDATIONS):** Nice to have. Improvements, alternatives.
5. **Phase 5: Information Gathering** — If Category A/B issues found: document, propose questions, request Agent 1 re-engage with user.

**Gate 2 Checklist:**
- [ ] Zero Category A blockers remain
- [ ] All Category B issues addressed
- [ ] Second pass completed (find what was missed first time)
- [ ] Considered: security, performance, scalability, accessibility, i18n, edge cases, error handling, logging, monitoring, deployment, CI/CD, testing

### Agent 3: Scaffolding Expert (Build Engineer)

**File:** `.claude/agents/03-scaffolding-expert.md`
**Role:** Create reproducible project scaffold with all dependencies locked.
**Input:** `pipeline/artifacts/SPEC.md`, `pipeline/artifacts/TECHNICAL-REVIEW.md`
**Output:** `pipeline/artifacts/SCAFFOLDING-MANIFEST.md` + actual project scaffold files.
**Quality Gate 3:** Build Quality.

**Deterministic Protocol:**
1. **Phase 1: Project Structure Design** — Source directory, tests, config, env example, gitignore, lock files.
2. **Phase 2: Dependency Selection** — For EACH dependency: exact version only (`"1.2.3"`), document rationale, verify compatibility. **NEVER** use `~`, `^`, `latest`, or `*`.
3. **Phase 3: Package Configuration** — All versions must be exact `x.y.z`. Lock files committed.
4. **Phase 4: Environment Configuration** — `.env.example` with ALL variables.
5. **Phase 5: Build Verification** — Install, build, and start in dev mode. All must succeed.

**Gate 3 Checklist:**
- [ ] Zero `~` or `^` in package manifest
- [ ] Lock file exists
- [ ] Install succeeds
- [ ] Build succeeds
- [ ] Dev server starts
- [ ] `.env.example` complete
- [ ] `.gitignore` complete

### Agent 4: Database Specialist (Data Architect)

**File:** `.claude/agents/04-database-specialist.md`
**Role:** Design complete data layer: schemas, migrations, indexes, access patterns.
**Input:** `pipeline/artifacts/SPEC.md`, `TECHNICAL-REVIEW.md`, `SCAFFOLDING-MANIFEST.md`
**Output:** `pipeline/artifacts/DATABASE-ARCHITECTURE.md` + actual schema/migration files.
**Quality Gate 4:** Database Quality.

**Deterministic Protocol:**
1. **Phase 1: Schema Design** — Entity-relationship analysis, normalization (3NF minimum), field specifications (name, type, constraints, indexes).
2. **Phase 2: Migration Strategy** — Idempotent, reversible, atomic migrations.
3. **Phase 3: Data Access Layer** — Repository pattern, query optimization, N+1 prevention.
4. **Phase 4: Seed Data** — Minimal realistic data, edge cases represented.

**Note:** Even projects without a persistent database (e.g., in-memory state) still need this agent. The in-memory state IS the data architecture and should be documented with the same rigor.

**Gate 4 Checklist:**
- [ ] All entities from spec represented
- [ ] All relationships correctly modeled
- [ ] All constraints appropriate
- [ ] Indexes for all query patterns
- [ ] Migrations are idempotent
- [ ] Rollback paths exist
- [ ] Data access layer complete

### Agent 5: Coding Expert (Principal Engineer)

**File:** `.claude/agents/05-coding-expert.md`
**Role:** Implement the complete application following all upstream artifacts.
**Input:** All 4 previous artifacts.
**Output:** `pipeline/artifacts/IMPLEMENTATION-REPORT.md` + actual source code.
**Quality Gate 5:** Code Quality.

**Deterministic Protocol:**
1. **Phase 1: Architecture Setup** — Layer architecture, configuration management.
2. **Phase 2: Implementation Standards** — Strict typing, custom error classes, structured logging, schema validation, security (sanitization, parameterized queries, rate limiting, CSRF).
3. **Phase 3: Testing** — Unit tests (90%+ coverage on business logic), integration tests (real DB), E2E tests (critical flows).
4. **Phase 4: Code Review Checklist** — No console.log (use logger), no hardcoded values (use config), no TODO comments, all errors handled, all inputs validated, no duplication, descriptive names, small focused functions, no magic numbers.

**Gate 5 Checklist:**
- [ ] All features from spec implemented
- [ ] All tests pass
- [ ] Lint passes (no warnings)
- [ ] TypeScript compiles (no errors, if applicable)
- [ ] No security vulnerabilities
- [ ] Code coverage meets threshold

### Agent 6: Frontend Designer (UI/UX Engineer)

**File:** `.claude/agents/06-frontend-designer.md`
**Role:** Ensure pixel-perfect design, responsive layout, accessibility, smooth animations.
**Input:** `pipeline/artifacts/SPEC.md` (Section 6: Visual & UX), `IMPLEMENTATION-REPORT.md`
**Output:** `pipeline/artifacts/FRONTEND-REPORT.md` + UI code changes.
**Quality Gate 6:** Design Quality.

**Deterministic Protocol:**
1. **Phase 1: Style Definition** — Define design system based on spec. Presets: Enterprise (navy/white, Inter, subtle shadows), Minimalist (BW+accent, max whitespace), Playful (vibrant, rounded), Brutalist (high contrast, bold).
2. **Phase 2: Component Architecture** — Atomic design: atoms (Button, Input), molecules (FormField, Card), organisms (Header, DataTable), templates (layouts), pages.
3. **Phase 3: Implementation** — Consistent styling, mobile-first responsive (640/768/1024/1280px), mandatory accessibility (semantic HTML, ARIA, keyboard nav, focus management, 4.5:1 contrast), performance (lazy load, optimize images, minimize re-renders), animations (300ms ease transitions).
4. **Phase 4: Design System Document.**

**Gate 6 Checklist:**
- [ ] Design matches specified style exactly
- [ ] All components implemented
- [ ] Responsive on all breakpoints
- [ ] Accessibility: keyboard, screen reader, contrast
- [ ] Animations smooth (60fps)
- [ ] CLS < 0.1
- [ ] Lighthouse > 90

### Agent 7: Release Documentarian (Technical Writer)

**File:** `.claude/agents/07-release-documentarian.md`
**Role:** Produce complete documentation package.
**Input:** All artifacts in `pipeline/artifacts/` + actual codebase.
**Output:** `pipeline/artifacts/DOCUMENTATION-REPORT.md` + docs files.
**Quality Gate 7:** Documentation Quality.

**Deterministic Protocol:**
1. **Phase 1: Testing Documentation** — `docs/TEST-PLAN.md`: scope, environment, test data, test case tables, run instructions, bug reporting template.
2. **Phase 2: README** — Badges, description, TOC, features, quick start, Docker, config table, API summary, architecture, contributing, license.
3. **Phase 3: User Manual** — `docs/USER-MANUAL.md`: intro, getting started, feature guide, advanced, troubleshooting, FAQ.
4. **Phase 4: API Documentation** — OpenAPI/Swagger spec.
5. **Phase 5: Marketing** — `docs/MARKETING.md`: ad copy, email sequence, landing page copy.

**Gate 7 Checklist:**
- [ ] README complete and accurate
- [ ] All features documented
- [ ] API docs match implementation
- [ ] User manual complete
- [ ] Tests documented
- [ ] Marketing copy written
- [ ] All code examples tested and working

### Agent 8: The Critic (QA Engineer)

**File:** `.claude/agents/08-the-critic.md`
**Role:** Verify EVERY agent's output. Demand perfection. Block release if quality insufficient.
**Output:** Verification receipts in `pipeline/receipts/`.

**Verification Protocol (per agent):**

| Agent | What to Verify |
|-------|---------------|
| Agent 1 | Every requirement has acceptance criteria. No ambiguous language. Happy + sad paths. Complete data model. Edge cases documented. |
| Agent 2 | All Category A resolved. All Category B addressed. Security + performance reviewed. |
| Agent 3 | Lock file exists. No `~`/`^` in versions. Install succeeds. Build succeeds. Dev server starts. |
| Agent 4 | All spec entities exist. Relationships correct. Indexes for queries. Idempotent migrations. |
| Agent 5 | All features implemented. Tests pass. No lint errors. No type errors. No security vulns. Coverage threshold met. |
| Agent 6 | Design matches spec. Responsive on all breakpoints. Keyboard + screen reader accessible. Lighthouse > 90. |
| Agent 7 | README accurate. API docs match code. Examples work. All docs complete. |

**Verification Receipt Format:**
```markdown
## Verification Receipt: Agent [X] - [COMPONENT]

### Files Changed
[List of files]

### Verification Results
| Check | Status | Notes |
|-------|--------|-------|
| Check 1 | PASS/FAIL | - |

### Issues Found
1. **Issue #1**: [Description]
   - Severity: CRITICAL/HIGH/MEDIUM
   - Location: file:line
   - Fix Required: [Description]

### Receipt
VERIFIED BY: The Critic
DATE: YYYY-MM-DD
AGENT: X
STATUS: PASS/FAIL
ISSUES: Count
```

**On FAIL:**
1. Block progression.
2. Generate `pipeline/receipts/BLOCK-agent-X.md`.
3. Return to failing agent.
4. After fixes: re-verify FROM SCRATCH (not incremental).

**Final Release Sign-off** (`pipeline/receipts/RELEASE-SIGNOFF.md`):
```markdown
# FINAL RELEASE SIGN-OFF
## Project: [NAME]
## Version: [X.Y.Z]
## Release Date: [DATE]

## Quality Gates Passed
| Gate | Agent | Status | Date |
|------|-------|--------|------|
| 1-7  | All   | PASS   | Date |

## Production Readiness
- [x] All features implemented
- [x] All tests passing
- [x] Documentation complete
- [x] Security review passed
- [x] Performance targets met

This is PUBLIC PRODUCTION RELEASE QUALITY.
```

---

## 7. QUALITY GATES REFERENCE

| Gate | Name | Agent | Pass Criteria |
|------|------|-------|---------------|
| 1 | Requirements Quality | Deep Planner | SPEC.md 100% complete, zero TBD/TODO, user sign-off |
| 2 | Technical Quality | Deep Thinker | Zero Category A blockers, security + performance reviewed |
| 3 | Build Quality | Scaffolding Expert | Working build, locked dependencies, passing tests |
| 4 | Database Quality | Database Specialist | Complete schema, all entities/relationships, idempotent migrations |
| 5 | Code Quality | Coding Expert | Zero critical bugs, coverage threshold met, zero security vulns |
| 6 | Design Quality | Frontend Designer | Matches spec, accessibility passes, Lighthouse > 90, responsive |
| 7 | Documentation Quality | Release Documentarian | Working code examples, accurate API docs, complete manual |

---

## 8. STEP-BY-STEP PIPELINE EXECUTION

### Step 0: Initialize

1. Open Claude Code in the A-TEAM directory.
2. Ensure these directories exist (create if not):
   ```
   pipeline/state/
   pipeline/artifacts/
   pipeline/receipts/
   ```
3. Create or reset `pipeline/state/pipeline-state.json`:
   ```json
   {
     "projectId": "your-project-id",
     "projectName": "Your Project Name",
     "currentAgent": "MASTER_CONTROLLER",
     "phase": "INIT",
     "artifacts": {},
     "verificationReceipts": [],
     "issues": [],
     "qualityGates": [],
     "createdAt": "2026-03-16T00:00:00Z",
     "updatedAt": "2026-03-16T00:00:00Z"
   }
   ```
4. Present your project requirements to the LLM.

### Step 1: Agent 1 — Deep Planner

**Action:** The LLM reads `.claude/agents/01-deep-planner.md` and follows its protocol.

**Process:**
1. LLM asks structured questions across 5 categories (or extracts answers from provided requirements).
2. LLM resolves all ambiguity.
3. LLM generates `pipeline/artifacts/SPEC.md`.

**Verification:** The LLM then reads `.claude/agents/08-the-critic.md` and verifies Gate 1:
- Every requirement has acceptance criteria?
- No ambiguous language ("some", "etc.", "as needed")?
- All user stories have happy + sad paths?
- Data model complete?
- Edge cases documented?

**If PASS:** Update pipeline state, proceed to Agent 2.
**If FAIL:** Document issues, return to Agent 1 for fixes, re-verify.

### Step 2: Agent 2 — Deep Thinker

**Action:** LLM reads `.claude/agents/02-deep-thinker.md` + `pipeline/artifacts/SPEC.md`.

**Process:**
1. Analyze logical consistency.
2. Evaluate technical feasibility.
3. Identify gaps.
4. Classify findings (A/B/C).
5. Resolve Category A/B issues (may require user input).
6. Perform second pass.
7. Generate `pipeline/artifacts/TECHNICAL-REVIEW.md`.

**Verification:** Gate 2 — Zero Category A, all B addressed, second pass done.

### Step 3: Agent 3 — Scaffolding Expert

**Action:** LLM reads `.claude/agents/03-scaffolding-expert.md` + SPEC.md + TECHNICAL-REVIEW.md.

**Process:**
1. Design project structure.
2. Select and lock dependencies (exact versions only).
3. Create package configuration.
4. Create `.env.example`.
5. Verify: install, build, dev server.
6. Generate `pipeline/artifacts/SCAFFOLDING-MANIFEST.md` + actual project files.

**Verification:** Gate 3 — No floating versions, lock file, build works, dev server starts.

### Step 4: Agent 4 — Database Specialist

**Action:** LLM reads `.claude/agents/04-database-specialist.md` + all prior artifacts.

**Process:**
1. Design schema (entities, relationships, fields).
2. Create migrations (idempotent, reversible).
3. Design data access layer.
4. Create seed data.
5. Generate `pipeline/artifacts/DATABASE-ARCHITECTURE.md` + actual schema files.

**Verification:** Gate 4 — All entities, correct relationships, indexes, idempotent migrations.

### Step 5: Agent 5 — Coding Expert

**Action:** LLM reads `.claude/agents/05-coding-expert.md` + all prior artifacts.

**Process:**
1. Set up architecture layers.
2. Implement all features following spec.
3. Write tests (unit, integration, E2E).
4. Self-review against checklist.
5. Generate `pipeline/artifacts/IMPLEMENTATION-REPORT.md` + source code.

**Verification:** Gate 5 — All features, tests pass, lint clean, no security vulns.

### Step 6: Agent 6 — Frontend Designer

**Action:** LLM reads `.claude/agents/06-frontend-designer.md` + SPEC.md + IMPLEMENTATION-REPORT.md.

**Process:**
1. Define design system.
2. Build/refine components.
3. Ensure responsive layout.
4. Verify accessibility.
5. Polish animations.
6. Generate `pipeline/artifacts/FRONTEND-REPORT.md` + UI changes.

**Verification:** Gate 6 — Matches spec, responsive, accessible, Lighthouse > 90.

### Step 7: Agent 7 — Release Documentarian

**Action:** LLM reads `.claude/agents/07-release-documentarian.md` + all artifacts + codebase.

**Process:**
1. Write test documentation.
2. Write README.
3. Write user manual.
4. Write API docs.
5. Write marketing copy.
6. Generate `pipeline/artifacts/DOCUMENTATION-REPORT.md` + docs files.

**Verification:** Gate 7 — README accurate, API docs match, examples work, all complete.

### Step 8: Final Release

When all 7 gates pass:
1. Agent 8 generates `pipeline/receipts/FINAL-VERIFICATION.md`.
2. Pipeline state set to COMPLETE.
3. Final deliverable is in `output/` directory.

---

## 9. ARTIFACT FORMAT SPECIFICATIONS

### SPEC.md (Agent 1)
See Section 6, Agent 1 above for the mandatory section structure.

### TECHNICAL-REVIEW.md (Agent 2)
```markdown
# Technical Review: [PROJECT NAME]

## Executive Summary
[One paragraph on feasibility and risk]

## Blocker Report

### Category A: Blockers (0 must remain)
- [Issue #]: [Description] → [Resolution]

### Category B: High Risk Items (0 remaining)
- [Issue #]: [Description] → [Resolution]

### Category C: Recommendations
- [Issue #]: [Description] → [Recommendation]

## Second Pass Findings
[Additional issues found on re-review]

## Confidence Score
[1-10]

## Sign-off
- [ ] Clear to proceed to scaffolding
```

### SCAFFOLDING-MANIFEST.md (Agent 3)
```markdown
# Scaffolding Complete: [PROJECT NAME]

## Project Structure
[Tree structure]

## Dependencies Installed

### Production Dependencies
| Package | Version | Rationale |
|---------|---------|-----------|

### Development Dependencies
| Package | Version | Rationale |
|---------|---------|-----------|

## Lock Verification
- [ ] Lock file generated
- [ ] Install successful
- [ ] Build successful
- [ ] Dev server starts

## Scripts Available
[List with descriptions]

## Confidence Score
[1-10]
```

### DATABASE-ARCHITECTURE.md (Agent 4)
```markdown
# Database Architecture: [PROJECT NAME]

## Schema Diagram
[Entity-relationship description]

## Tables/Collections
### [table_name]
| Column | Type | Constraints | Index |
|--------|------|-------------|-------|

## Migrations
[Migration list]

## Data Access
[Repository interfaces]

## Seed Data
[Description]

## Performance Considerations
[Query optimization notes]

## Confidence Score
[1-10]
```

### IMPLEMENTATION-REPORT.md (Agent 5)
```markdown
# Implementation Complete: [PROJECT NAME]

## Features Implemented
- [ ] Feature 1: [Status]

## Code Quality Metrics
- Lines of code: [X]
- Test coverage: [X]%

## Security
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS prevention

## Testing
- Unit tests: [X]
- Integration tests: [X]
- E2E tests: [X]
- All passing: [Y/N]

## Confidence Score
[1-10]
```

### FRONTEND-REPORT.md (Agent 6)
```markdown
# Frontend Complete: [PROJECT NAME]

## Style Implemented
[Details]

## Components Built
[List with variants]

## Responsive Breakpoints
[Breakpoints tested]

## Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader
- [ ] Color contrast
- [ ] Focus management

## Performance
- Lighthouse: [X]

## Confidence Score
[1-10]
```

### DOCUMENTATION-REPORT.md (Agent 7)
```markdown
# Documentation Complete: [PROJECT NAME]

## Deliverables
- [x] README.md
- [x] User Manual
- [x] API Documentation
- [x] Test Plan
- [x] Marketing Copy

## Documentation Coverage
- Features documented: [X]%
- API endpoints: [X]%
- User flows: [X]%

## Quality Check
- [ ] Code examples tested
- [ ] Links working
- [ ] Grammar verified

## Confidence Score
[1-10]
```

---

## 10. PIPELINE STATE JSON SCHEMA

```json
{
  "projectId": "string — unique project identifier",
  "projectName": "string — human-readable project name",
  "currentAgent": "string — MASTER_CONTROLLER | PLANNER | THINKER | SCAFFOLDER | DATABASE | CODER | DESIGNER | DOCUMENTARIAN | CRITIC",
  "phase": "string — INIT | REQUIREMENTS | TECHNICAL_REVIEW | SCAFFOLDING | DATABASE | IMPLEMENTATION | FRONTEND | DOCUMENTATION | RELEASE | COMPLETE",
  "artifacts": {
    "spec": "string — path to SPEC.md",
    "review": "string — path to TECHNICAL-REVIEW.md",
    "scaffold": "string — path to SCAFFOLDING-MANIFEST.md",
    "database": "string — path to DATABASE-ARCHITECTURE.md",
    "code": "string — path to IMPLEMENTATION-REPORT.md",
    "frontend": "string — path to FRONTEND-REPORT.md",
    "documentation": "string — path to DOCUMENTATION-REPORT.md"
  },
  "verificationReceipts": ["string — paths to receipt files"],
  "issues": ["string — any unresolved issues"],
  "qualityGates": [
    {
      "gate": "number — 1-7",
      "name": "string — gate name",
      "status": "string — PASS | FAIL | PENDING",
      "agent": "string — agent name"
    }
  ],
  "createdAt": "string — ISO 8601 timestamp",
  "updatedAt": "string — ISO 8601 timestamp"
}
```

---

## 11. OPERATING THE PIPELINE AS A SINGLE LLM

This section is for an LLM without sub-agent capabilities (no ability to spawn specialized agents). You will role-play each agent in sequence.

### Execution Protocol

1. **Read the Master Controller prompt** (`.claude/agents/00-master-controller.md`). Understand the pipeline flow.

2. **For each agent (1 through 7), in order:**
   a. Read the agent's prompt file (`.claude/agents/0X-agent-name.md`).
   b. Read all required input artifacts.
   c. Follow the agent's deterministic protocol exactly.
   d. Generate the agent's output artifact and save it to `pipeline/artifacts/`.
   e. Switch to Critic mode: read `.claude/agents/08-the-critic.md`.
   f. Verify the agent's output against the quality gate.
   g. If PASS: save a verification receipt to `pipeline/receipts/`, update `pipeline-state.json`, proceed.
   h. If FAIL: save a block report, return to the agent, fix issues, re-verify from scratch.

3. **After all 7 agents pass:** Generate the final release sign-off.

### Key Rules for Single-LLM Operation

- **Do not skip agents.** Even if an agent seems unnecessary (e.g., "no database needed"), run it anyway. It will adapt to the project scope.
- **Do not merge agent steps.** Each agent must produce its own artifact and be verified independently.
- **Read previous artifacts before each agent.** The sequential context chain is critical.
- **Verify from scratch on failure.** After fixing an issue, re-run the full verification for that agent — not an incremental check.
- **Save pipeline state after every gate.** If context is lost, you can resume from the last saved state.
- **User interaction is only needed at Agent 1.** Agent 1 may need to ask the user questions. All subsequent agents work from artifacts only.

### Context Management Strategy

The full pipeline may exceed a single context window. Strategies:

1. **Artifact-driven continuity:** Each agent's output artifact contains all decisions and context needed by downstream agents. If you lose context, re-read the artifacts.
2. **Pipeline state as bookmark:** `pipeline-state.json` tells you exactly where you are. Resume from the current phase.
3. **One agent per conversation:** If context limits are a concern, run one agent per conversation. Start each conversation by reading:
   - `pipeline-state.json` (where you are)
   - The current agent's prompt file
   - All prior artifacts
   - Then execute the agent's protocol and save the artifact.

---

## 12. HUMAN OPERATOR DEPLOYMENT GUIDE

This section is for a human deploying the A-TEAM to build software using a non-interactive LLM.

### 12.1 Initial Setup

```bash
# Clone the A-TEAM repo
git clone <repo-url> A-TEAM
cd A-TEAM

# Create directories if they don't exist
mkdir -p pipeline/state pipeline/artifacts pipeline/receipts output
```

### 12.2 Prepare Your Requirements

Write your project requirements in as much detail as possible. The more detail you provide, the fewer questions Agent 1 needs to ask. Include:
- What the system should do (specific features)
- Target users
- Technology preferences
- Design style
- Performance requirements
- Any constraints

Save this as a text file or prepare to paste it into your first prompt.

### 12.3 Running with Claude Code CLI

```bash
cd A-TEAM
claude
```

Then provide your requirements. Claude Code will:
1. Detect the agent definitions in `.claude/agents/`.
2. Follow the Master Controller protocol.
3. Execute each agent in sequence.
4. Produce artifacts in `pipeline/artifacts/`.
5. Deliver the final output in `output/`.

### 12.4 Running with Any LLM (Manual Agent Execution)

If you are using an LLM that doesn't auto-detect agent files:

1. Start a conversation with the LLM.
2. Paste the contents of `.claude/agents/00-master-controller.md` as context.
3. Paste the contents of `.claude/agents/01-deep-planner.md`.
4. Paste your requirements.
5. Let the LLM execute Agent 1's protocol.
6. Save the generated SPEC.md.
7. Start a new conversation (or continue if context allows).
8. Paste Agent 2's prompt + SPEC.md.
9. Continue through all agents.

### 12.5 Monitoring Progress

Check `pipeline/state/pipeline-state.json` after each gate to see:
- Current phase
- Which gates have passed
- Any outstanding issues

### 12.6 Handling Gate Failures

If a gate fails:
1. Read the block report in `pipeline/receipts/BLOCK-agent-X.md`.
2. The report lists exactly what failed and what needs to be fixed.
3. Feed the block report back to the LLM with the failing agent's prompt.
4. Let the LLM fix the issues.
5. Re-verify from scratch.

---

## 13. TROUBLESHOOTING & RECOVERY

### Pipeline is stuck at a gate
Read the latest receipt in `pipeline/receipts/`. It will list exactly which checks failed. Address each failed check specifically.

### Context window exceeded
Split into per-agent conversations. Each agent reads only its input artifacts, not the entire history. The artifacts ARE the context.

### Agent produces incomplete artifact
The Critic should catch this. If it doesn't, manually verify the artifact against the format specification in Section 9. Missing sections = gate fail.

### Need to restart from a specific agent
1. Set `pipeline-state.json` phase to the desired state.
2. Ensure all prior artifacts exist in `pipeline/artifacts/`.
3. Start execution from that agent's prompt + prior artifacts.

### Multiple gate failures on the same agent
If an agent fails the same gate 3+ times, it likely means the upstream spec is insufficient. Go back to Agent 1 and strengthen the spec, then re-run from Agent 2 forward.

---

## 14. BEST PRACTICES

1. **Feed Agent 1 maximum detail.** The pipeline is only as good as the spec. Vague requirements = vague output.

2. **Don't skip Agent 2.** The Deep Thinker finds real bugs before a single line of code is written. It caught clipboard API issues and dynamic step counter bugs in our test run.

3. **Keep the pipeline sequential.** Each agent reads previous artifacts. Skipping agents means missing context.

4. **The Critic is not optional.** Quality gates are the entire point. If something fails, fix it and re-verify.

5. **Artifacts are your audit trail.** Every decision, validation, and finding is documented. When something breaks, trace back to which gate missed it.

6. **Scale to your project.** A single HTML file doesn't need heavy scaffolding. A full-stack SaaS app will have Agent 3 generating Docker configs. The agents adapt.

7. **Invest in the spec.** Quality compounds. When Agent 1's spec includes exact colors, typography, and spacing, Agent 5 implements precisely, and Agent 6 has nothing to fix.

8. **Test in the real environment.** Agent 5 should test in an actual browser/runtime, not mentally simulate. Real tests catch real bugs (`file://` protocol breaks clipboard API, for example).

---

## APPENDIX: AGENT FILE MANIFEST

| Agent | File | Lines | Purpose |
|-------|------|-------|---------|
| 0 | `.claude/agents/00-master-controller.md` | ~110 | Pipeline orchestrator |
| 1 | `.claude/agents/01-deep-planner.md` | ~125 | Requirements extraction |
| 2 | `.claude/agents/02-deep-thinker.md` | ~107 | Technical review |
| 3 | `.claude/agents/03-scaffolding-expert.md` | ~122 | Project scaffolding |
| 4 | `.claude/agents/04-database-specialist.md` | ~102 | Data architecture |
| 5 | `.claude/agents/05-coding-expert.md` | ~100 | Implementation |
| 6 | `.claude/agents/06-frontend-designer.md` | ~126 | UI/UX design |
| 7 | `.claude/agents/07-release-documentarian.md` | ~102 | Documentation |
| 8 | `.claude/agents/08-the-critic.md` | ~149 | Quality verification |
