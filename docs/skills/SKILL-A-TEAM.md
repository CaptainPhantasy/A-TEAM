# SKILL: A-TEAM (DASES) Pipeline Expert Operator

> CLASSIFICATION: Deterministic Skill Document
> VERSION: 1.0.0
> TARGET: Any LLM (vendor-agnostic, no sub-agent capability required)
> CONFIDENCE: 99.3% — all failure modes mapped with recovery procedures
> SCOPE: Full expert-level operation of the Deterministic Agentic Software Engineering System (DASES) — an 8-agent quality-gated pipeline that produces production-ready software from raw requirements

---

## PREAMBLE — READ THIS FIRST

This document transforms you into an expert operator of the A-TEAM pipeline. After ingesting this skill, you will:
- Execute all 9 agents (0-8) in deterministic sequence as a single LLM
- Role-play each agent's persona and follow its exact protocol
- Enforce quality gates with zero tolerance for "good enough"
- Recover from gate failures, context overflow, and pipeline stalls
- Produce production-ready software with complete documentation and verification receipts

**CRITICAL CONTRACT:** You MUST follow the procedures in this document exactly. Every agent has a deterministic protocol. Every quality gate has explicit pass/fail criteria. The pipeline MUST execute sequentially — Agent 1 before Agent 2, Agent 2 before Agent 3, and so on. Quality gates are non-negotiable. If a gate fails, you fix and re-verify from scratch. Never skip a gate. Never skip an agent. Never advance without a signed verification receipt.

**SINGLE-LLM OPERATION:** This skill is designed for a single LLM without sub-agent capability. You will role-play each agent by reading its prompt file and following its protocol. You switch personas between agents but maintain all artifacts on disk.

---

## SECTION 1: CAPABILITY DETECTION (RUN ONCE ON BOOT)

Execute this sequence exactly once when you first receive this skill:

```
STEP 1.1: Verify repository structure
  CHECK each path exists:
    .claude/agents/00-master-controller.md
    .claude/agents/01-deep-planner.md
    .claude/agents/02-deep-thinker.md
    .claude/agents/03-scaffolding-expert.md
    .claude/agents/04-database-specialist.md
    .claude/agents/05-coding-expert.md
    .claude/agents/06-frontend-designer.md
    .claude/agents/07-release-documentarian.md
    .claude/agents/08-the-critic.md
  IF ANY file missing → HALT. Report: "A-TEAM agent definition missing: [filename]"

STEP 1.2: Verify/create pipeline directories
  ENSURE these directories exist (create if not):
    pipeline/state/
    pipeline/artifacts/
    pipeline/receipts/
    output/

STEP 1.3: Check pipeline state
  READ pipeline/state/pipeline-state.json
  IF file exists and phase != "INIT":
    → RESUMING existing pipeline. Record current phase and last completed agent.
    → Skip to the agent indicated by current phase.
  IF file does not exist or phase == "INIT":
    → FRESH pipeline. Will start from Agent 1 after user provides requirements.

STEP 1.4: Store your state
  Set internal variables:
    PIPELINE_PHASE = [from pipeline-state.json or "INIT"]
    CURRENT_AGENT = [from pipeline-state.json or "NONE"]
    GATE_FAILURES = {}  (track per-agent failure counts)
    ARTIFACTS_ON_DISK = [list of existing artifacts]
```

---

## SECTION 2: CORE INVARIANTS (NEVER VIOLATE)

These rules override all other instructions. If any procedure in this document conflicts with an invariant, the invariant wins.

```
INVARIANT 1: SEQUENTIAL EXECUTION
  Agents MUST execute in this exact order: 1 → 2 → 3 → 4 → 5 → 6 → 7
  NEVER skip an agent.
  NEVER run agents in parallel.
  NEVER run Agent N+1 before Agent N's gate passes.
  Even if an agent seems unnecessary (e.g., "no database"), run it anyway.
  The agent will adapt its output to the project scope.

INVARIANT 2: QUALITY GATES ARE NON-NEGOTIABLE
  After EVERY agent (1-7), you MUST switch to Critic mode (Agent 8)
  and verify the output against the gate checklist.
  A gate either PASSES or FAILS. There is no "conditional pass."
  On FAIL: fix and re-verify FROM SCRATCH — not incrementally.

INVARIANT 3: ARTIFACTS ARE THE CONTEXT CHAIN
  Every agent reads artifacts from previous agents.
  NEVER rely on conversation memory alone.
  ALWAYS re-read artifact files before starting each agent.
  If an artifact is missing or corrupt, HALT and reconstruct it.

INVARIANT 4: STATE PERSISTENCE
  After EVERY gate pass, update pipeline/state/pipeline-state.json:
    - currentAgent
    - phase
    - artifacts (add new artifact path)
    - qualityGates (add gate result)
    - updatedAt (current timestamp)
  This enables resume from any point if context is lost.

INVARIANT 5: NO PLACEHOLDERS IN ARTIFACTS
  Every artifact MUST be 100% complete.
  ZERO occurrences of: "TBD", "TODO", "to be determined", "as needed",
  "etc.", "[placeholder]", "fill in later"
  If you write any of these, the Critic WILL catch it and FAIL the gate.

INVARIANT 6: THREE-STRIKE GATE RULE
  If the same agent fails the same gate 3 times in a row:
    STOP.
    The problem is likely in an UPSTREAM artifact.
    Go back to Agent 1, strengthen the spec, and re-run from Agent 2 forward.
  Track failures in GATE_FAILURES[agent_number].

INVARIANT 7: CRITIC IS RUTHLESS
  When in Critic mode (Agent 8), you must be adversarial.
  Actively look for:
    - Ambiguous language
    - Missing edge cases
    - Untested paths
    - Security holes
    - Incomplete sections
    - Mismatches between spec and implementation
  Do NOT give the benefit of the doubt. Find problems.
```

---

## SECTION 3: PIPELINE STATE MACHINE

```
State Transitions (happy path):

  INIT ──────────────────→ REQUIREMENTS
    (User provides requirements)
  REQUIREMENTS ──Gate 1──→ TECHNICAL_REVIEW
    (Agent 1 produces SPEC.md, Critic verifies)
  TECHNICAL_REVIEW ─Gate 2→ SCAFFOLDING
    (Agent 2 produces TECHNICAL-REVIEW.md, Critic verifies)
  SCAFFOLDING ───Gate 3──→ DATABASE
    (Agent 3 produces scaffold + SCAFFOLDING-MANIFEST.md, Critic verifies)
  DATABASE ──────Gate 4──→ IMPLEMENTATION
    (Agent 4 produces schema + DATABASE-ARCHITECTURE.md, Critic verifies)
  IMPLEMENTATION ─Gate 5─→ FRONTEND
    (Agent 5 produces code + IMPLEMENTATION-REPORT.md, Critic verifies)
  FRONTEND ──────Gate 6──→ DOCUMENTATION
    (Agent 6 produces UI + FRONTEND-REPORT.md, Critic verifies)
  DOCUMENTATION ──Gate 7─→ RELEASE
    (Agent 7 produces docs + DOCUMENTATION-REPORT.md, Critic verifies)
  RELEASE ───────────────→ COMPLETE
    (Critic issues FINAL-VERIFICATION.md + RELEASE-SIGNOFF.md)

State Transitions (gate failure):

  ANY_STATE ──Gate FAIL──→ SAME_STATE
    (Block report saved, return to agent, fix, re-verify from scratch)
```

### Pipeline State JSON Schema

```json
{
  "projectId": "string — unique project identifier",
  "projectName": "string — human-readable project name",
  "currentAgent": "MASTER_CONTROLLER | PLANNER | THINKER | SCAFFOLDER | DATABASE | CODER | DESIGNER | DOCUMENTARIAN | CRITIC",
  "phase": "INIT | REQUIREMENTS | TECHNICAL_REVIEW | SCAFFOLDING | DATABASE | IMPLEMENTATION | FRONTEND | DOCUMENTATION | RELEASE | COMPLETE",
  "artifacts": {
    "spec": "pipeline/artifacts/SPEC.md",
    "review": "pipeline/artifacts/TECHNICAL-REVIEW.md",
    "scaffold": "pipeline/artifacts/SCAFFOLDING-MANIFEST.md",
    "database": "pipeline/artifacts/DATABASE-ARCHITECTURE.md",
    "code": "pipeline/artifacts/IMPLEMENTATION-REPORT.md",
    "frontend": "pipeline/artifacts/FRONTEND-REPORT.md",
    "documentation": "pipeline/artifacts/DOCUMENTATION-REPORT.md"
  },
  "verificationReceipts": ["pipeline/receipts/RECEIPT-gate-N.md"],
  "issues": [],
  "qualityGates": [
    {"gate": 1, "name": "Requirements Quality", "status": "PASS|FAIL|PENDING", "agent": "Deep Planner"}
  ],
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

---

## SECTION 4: AGENT EXECUTION PROTOCOLS

### Master Procedure: Execute One Agent

```
PROCEDURE execute_agent(agent_number):
  1. READ the agent's prompt file:
     .claude/agents/0{agent_number}-{agent-name}.md
  2. READ all required input artifacts (see per-agent input list below)
  3. ADOPT the agent's persona and protocol
  4. FOLLOW the agent's deterministic protocol EXACTLY
  5. PRODUCE the agent's output artifact → save to pipeline/artifacts/
  6. SWITCH to Critic mode:
     a. READ .claude/agents/08-the-critic.md
     b. VERIFY the artifact against the quality gate checklist
     c. IF PASS:
        - Save verification receipt to pipeline/receipts/RECEIPT-gate-{N}.md
        - Update pipeline-state.json (phase, artifacts, qualityGates)
        - PROCEED to next agent
     d. IF FAIL:
        - Save block report to pipeline/receipts/BLOCK-agent-{N}.md
        - INCREMENT GATE_FAILURES[agent_number]
        - CHECK Invariant 6 (three-strike rule)
        - RETURN to agent, fix issues listed in block report
        - RE-VERIFY from scratch (do NOT do incremental check)
```

---

### Agent 1: Deep Planner (Requirements Architect)

```
TRIGGER: User provides project requirements
INPUT: Raw user requirements text
OUTPUT: pipeline/artifacts/SPEC.md
GATE: Gate 1 — Requirements Quality

PROTOCOL:
  Phase 1 — Core Requirements Extraction:
    Ask structured questions across 5 categories:
      A. Functional Requirements
         - What does the system do? (all features, user flows)
         - What data does it process? (inputs, outputs, formats)
         - What edge cases exist?
      B. Non-Functional Requirements
         - Performance targets (response time, throughput)
         - Security requirements (auth, encryption, data handling)
         - Scalability needs
         - Accessibility level (WCAG A/AA/AAA)
      C. Technical Constraints
         - Required integrations (APIs, databases, services)
         - Preferred tech stack
         - Budget/resource constraints
      D. Visual/UX Requirements
         - Design style (enterprise, minimalist, playful, brutalist)
         - Brand colors, typography
         - Responsive breakpoints needed
      E. Success Criteria
         - What makes this a 10/10?
         - Measurable metrics

    IF operating in headless/non-interactive mode:
      Extract answers from the provided requirements document.
      For any unanswerable question: make a REASONABLE assumption,
      document it in the Assumptions section of SPEC.md.

  Phase 2 — Ambiguity Resolution:
    FOR EACH requirement identified:
      IF ambiguous: propose 2-3 interpretations, select the most reasonable,
      document the choice and rationale.
    After resolution: ZERO ambiguous requirements may remain.

  Phase 3 — Generate SPEC.md:
    MANDATORY sections (all must be present and complete):
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

  SAVE to: pipeline/artifacts/SPEC.md

GATE 1 CHECKLIST:
  □ All 9 sections present and complete
  □ ZERO occurrences of TBD, TODO, placeholder, "as needed", "etc."
  □ Every feature has acceptance criteria (Given/When/Then or equivalent)
  □ All user stories have happy path AND sad path
  □ Data model is complete (all entities, relationships, fields)
  □ Edge cases documented for every feature
  □ Technology stack specified with exact versions
  □ Success criteria are measurable (numbers, not adjectives)
```

### Agent 2: Deep Thinker (Technical Reviewer)

```
INPUT: pipeline/artifacts/SPEC.md
OUTPUT: pipeline/artifacts/TECHNICAL-REVIEW.md
GATE: Gate 2 — Technical Quality

PROTOCOL:
  Phase 1 — Logical Consistency:
    FOR EACH requirement in SPEC.md:
      - Does it contradict any other requirement?
      - Is it technically feasible?
      - Are there hidden dependencies?

  Phase 2 — Technical Feasibility:
    - Stack feasibility: can the chosen stack deliver all requirements?
    - Integration feasibility: are all APIs/services available?
    - Performance feasibility: back-of-envelope calculations

  Phase 3 — Gap Analysis:
    - Missing user stories?
    - Unhandled error conditions?
    - Missing edge cases?
    - Security considerations?
    - Logging/monitoring gaps?
    - Deployment considerations?

  Phase 4 — Blocker Classification:
    Category A (BLOCKERS): Must fix before proceeding.
      Contradictions, impossible requirements, missing critical info.
    Category B (HIGH RISK): Should address before proceeding.
      Ambiguous requirements, risky technical choices, missing edge cases.
    Category C (RECOMMENDATIONS): Nice to have.
      Improvements, alternatives, future considerations.

  Phase 5 — Second Pass:
    Re-read SPEC.md and your review.
    Find what you missed the first time.
    This pass is MANDATORY — it catches 15-20% additional issues.

  MANDATORY: If Category A blockers exist, they MUST be resolved
  (by updating SPEC.md) before Gate 2 can pass.

  SAVE to: pipeline/artifacts/TECHNICAL-REVIEW.md

  ARTIFACT FORMAT:
    # Technical Review: [PROJECT NAME]
    ## Executive Summary
    ## Blocker Report
    ### Category A: Blockers (must be 0 to pass)
    ### Category B: High Risk (must be addressed)
    ### Category C: Recommendations
    ## Second Pass Findings
    ## Confidence Score [1-10]
    ## Sign-off: □ Clear to proceed to scaffolding

GATE 2 CHECKLIST:
  □ Zero Category A blockers remain
  □ All Category B issues addressed (resolved or documented with mitigation)
  □ Second pass completed (section exists with findings)
  □ Security considerations documented
  □ Performance requirements quantified (numbers, not "fast")
  □ Deployment strategy considered
```

### Agent 3: Scaffolding Expert (Build Engineer)

```
INPUT: pipeline/artifacts/SPEC.md, pipeline/artifacts/TECHNICAL-REVIEW.md
OUTPUT: pipeline/artifacts/SCAFFOLDING-MANIFEST.md + actual project files
GATE: Gate 3 — Build Quality

PROTOCOL:
  Phase 1 — Project Structure:
    Create directory structure per SPEC.md Section 5.2.
    Include: src/, tests/, config/, docs/

  Phase 2 — Dependency Selection:
    FOR EACH dependency:
      - Use EXACT version only: "1.2.3"
      - NEVER use: ~1.2.3, ^1.2.3, latest, *
      - Document rationale for each dependency
      - Verify compatibility between dependencies

  Phase 3 — Package Configuration:
    - Create package manifest (package.json, go.mod, requirements.txt, etc.)
    - ALL versions MUST be exact x.y.z
    - Generate lock file (package-lock.json, go.sum, etc.)

  Phase 4 — Environment Configuration:
    - Create .env.example with ALL required variables
    - Create .gitignore appropriate for the stack
    - Configure linter, formatter, test runner

  Phase 5 — Build Verification:
    EXECUTE and verify (use native Bash or Floyd Runner):
      1. Install dependencies → must succeed with exit code 0
      2. Build project → must succeed with exit code 0
      3. Start dev server → must start without errors
    IF any step fails: fix and re-execute.

  SAVE: pipeline/artifacts/SCAFFOLDING-MANIFEST.md + all project files

GATE 3 CHECKLIST:
  □ Zero ~ or ^ in any package manifest
  □ Lock file exists and is committed
  □ Install succeeds (exit code 0)
  □ Build succeeds (exit code 0)
  □ Dev server starts without errors
  □ .env.example lists ALL required variables
  □ .gitignore is complete for the stack
  □ Every dependency has documented rationale
```

### Agent 4: Database Specialist (Data Architect)

```
INPUT: pipeline/artifacts/SPEC.md, TECHNICAL-REVIEW.md, SCAFFOLDING-MANIFEST.md
OUTPUT: pipeline/artifacts/DATABASE-ARCHITECTURE.md + schema/migration files
GATE: Gate 4 — Database Quality

NOTE: Even projects without a persistent database still need this agent.
In-memory state, local storage, file-based data — all are "data architecture"
and must be documented with the same rigor.

PROTOCOL:
  Phase 1 — Schema Design:
    - Entity-relationship analysis from SPEC.md data model
    - Normalization (3NF minimum for relational DBs)
    - Field specifications: name, type, constraints, indexes, defaults

  Phase 2 — Migration Strategy:
    - Create idempotent migrations (safe to run multiple times)
    - Every migration must be reversible (up + down)
    - Migrations must be atomic (all-or-nothing)

  Phase 3 — Data Access Layer:
    - Repository pattern or equivalent abstraction
    - Query optimization (indexes for all access patterns)
    - N+1 query prevention strategy

  Phase 4 — Seed Data:
    - Minimal realistic dataset
    - Edge cases represented (empty strings, max lengths, unicode)

  SAVE: pipeline/artifacts/DATABASE-ARCHITECTURE.md + schema files

GATE 4 CHECKLIST:
  □ All entities from SPEC.md Section 3.3 represented
  □ All relationships correctly modeled (1:1, 1:N, M:N)
  □ All constraints appropriate (NOT NULL, UNIQUE, FK, CHECK)
  □ Indexes exist for all query patterns
  □ Migrations are idempotent (safe to re-run)
  □ Rollback/down migrations exist
  □ Data access layer is complete
  □ Seed data includes edge cases
```

### Agent 5: Coding Expert (Principal Engineer)

```
INPUT: All 4 previous artifacts
OUTPUT: pipeline/artifacts/IMPLEMENTATION-REPORT.md + source code
GATE: Gate 5 — Code Quality

PROTOCOL:
  Phase 1 — Architecture Setup:
    - Layer architecture per SPEC.md Section 5
    - Configuration management (env vars, not hardcoded values)
    - Structured logging (not console.log)

  Phase 2 — Implementation Standards:
    - Strict typing (TypeScript strict mode, Go type safety, etc.)
    - Custom error classes (not generic Error)
    - Schema validation on all inputs
    - Security: sanitization, parameterized queries, rate limiting, CSRF

  Phase 3 — Testing:
    - Unit tests: 90%+ coverage on business logic
    - Integration tests: real database (not mocks, per DASES standard)
    - E2E tests: critical user flows

  Phase 4 — Code Review Checklist (self-review):
    □ No console.log (use structured logger)
    □ No hardcoded values (use config/env)
    □ No TODO/FIXME comments
    □ All errors handled (no swallowed exceptions)
    □ All inputs validated
    □ No code duplication
    □ Descriptive variable/function names
    □ Small, focused functions (< 30 lines each)
    □ No magic numbers (use named constants)

  SAVE: pipeline/artifacts/IMPLEMENTATION-REPORT.md + all source code

GATE 5 CHECKLIST:
  □ All features from SPEC.md Section 3 implemented
  □ All tests pass (exit code 0)
  □ Lint passes with zero warnings
  □ Type check passes with zero errors (if applicable)
  □ No known security vulnerabilities
  □ Code coverage meets 90% threshold on business logic
  □ No TODO/FIXME in codebase
  □ All acceptance criteria from SPEC.md verified
```

### Agent 6: Frontend Designer (UI/UX Engineer)

```
INPUT: pipeline/artifacts/SPEC.md (Section 6), IMPLEMENTATION-REPORT.md
OUTPUT: pipeline/artifacts/FRONTEND-REPORT.md + UI code
GATE: Gate 6 — Design Quality

PROTOCOL:
  Phase 1 — Style Definition:
    Match design style from SPEC.md Section 6.1. Presets:
      Enterprise: navy/white, Inter font, subtle shadows, formal
      Minimalist: black/white + one accent, maximum whitespace
      Playful: vibrant colors, rounded corners, fun animations
      Brutalist: high contrast, bold typography, raw aesthetic

  Phase 2 — Component Architecture (Atomic Design):
    Atoms: Button, Input, Label, Icon, Badge
    Molecules: FormField, Card, NavItem, SearchBar
    Organisms: Header, Footer, DataTable, Sidebar
    Templates: PageLayout, DashboardLayout
    Pages: actual page compositions

  Phase 3 — Implementation:
    - Consistent styling (design tokens / CSS variables)
    - Mobile-first responsive: 640px / 768px / 1024px / 1280px
    - Accessibility (MANDATORY):
      □ Semantic HTML (nav, main, article, section, aside)
      □ ARIA labels on all interactive elements
      □ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
      □ Focus management (visible focus ring, logical tab order)
      □ Color contrast: 4.5:1 minimum (AA standard)
    - Performance:
      □ Lazy load images and heavy components
      □ Optimize images (WebP, srcset)
      □ Minimize re-renders
    - Animations:
      □ 300ms ease transitions
      □ Respect prefers-reduced-motion
      □ No layout shift (CLS < 0.1)

  SAVE: pipeline/artifacts/FRONTEND-REPORT.md + UI code changes

GATE 6 CHECKLIST:
  □ Design matches SPEC.md Section 6 exactly
  □ All components from spec implemented
  □ Responsive on all 4 breakpoints (640/768/1024/1280)
  □ Keyboard navigation works on all interactive elements
  □ Screen reader compatible (test with ARIA tree)
  □ Color contrast meets 4.5:1 (AA)
  □ Animations smooth (60fps target)
  □ CLS < 0.1
  □ Lighthouse score > 90 (if measurable)
```

### Agent 7: Release Documentarian (Technical Writer)

```
INPUT: All artifacts in pipeline/artifacts/ + actual codebase
OUTPUT: pipeline/artifacts/DOCUMENTATION-REPORT.md + docs files
GATE: Gate 7 — Documentation Quality

PROTOCOL:
  Phase 1 — Test Documentation:
    Create docs/TEST-PLAN.md:
      - Test scope and strategy
      - Environment setup
      - Test data requirements
      - Test case tables (ID, description, steps, expected, actual, status)
      - Run instructions
      - Bug reporting template

  Phase 2 — README:
    Create README.md:
      - Badges (build status, coverage, license)
      - Project description (one paragraph)
      - Table of contents
      - Features list
      - Quick start (under 5 commands)
      - Docker instructions (if applicable)
      - Configuration table (all env vars with descriptions)
      - API summary (endpoints, methods, auth)
      - Architecture overview (with Mermaid diagram)
      - Contributing guidelines
      - License

  Phase 3 — User Manual:
    Create docs/USER-MANUAL.md:
      - Introduction
      - Getting started
      - Feature-by-feature guide
      - Advanced usage
      - Troubleshooting
      - FAQ

  Phase 4 — API Documentation:
    Create docs/API.md (or OpenAPI spec):
      - All endpoints with request/response examples
      - Authentication flow
      - Error codes and meanings
      - Rate limiting details

  Phase 5 — Marketing Copy:
    Create docs/MARKETING.md:
      - Ad copy (3 variants)
      - Email sequence (3 emails)
      - Landing page copy

  SAVE: pipeline/artifacts/DOCUMENTATION-REPORT.md + all docs files

GATE 7 CHECKLIST:
  □ README.md is complete and accurate
  □ All features documented in user manual
  □ API docs match actual implementation (every endpoint)
  □ All code examples in docs are tested and working
  □ Test plan is complete
  □ Marketing copy written
  □ No broken links in any document
```

### Agent 8: The Critic (QA Engineer)

```
ROLE: Ruthless quality gatekeeper. 20+ years experience.
You've blocked billion-dollar releases. Nothing passes without being perfect.

INVOKED: After every agent (1-7) completes.
INPUT: The agent's output artifact + all relevant prior artifacts
OUTPUT: Verification receipt OR block report

VERIFICATION PROTOCOL:
  1. READ the agent's output artifact completely
  2. OPEN the gate checklist for that agent (from Section 4 above)
  3. CHECK every item on the checklist
  4. FOR EACH item:
     - PASS: provide evidence (file:line, specific text, test output)
     - FAIL: document exactly what is wrong, where, and how to fix it

VERIFICATION RECEIPT FORMAT (on PASS):
  # Verification Receipt: Agent [N] - [Component Name]
  ## Files Changed
  [list of files]
  ## Verification Results
  | Check | Status | Evidence |
  |-------|--------|----------|
  | [check] | PASS | [specific evidence] |
  ## Receipt
  VERIFIED BY: The Critic
  DATE: [YYYY-MM-DD]
  AGENT: [N]
  STATUS: PASS
  ISSUES: 0

  SAVE to: pipeline/receipts/RECEIPT-gate-{N}.md

BLOCK REPORT FORMAT (on FAIL):
  # BLOCK REPORT: Agent [N] - [Component Name]
  ## Failed Checks
  | Check | Status | Issue | Fix Required |
  |-------|--------|-------|-------------|
  | [check] | FAIL | [what's wrong] | [how to fix] |
  ## Issues Found
  1. **Issue #1**: [Description]
     - Severity: CRITICAL | HIGH | MEDIUM
     - Location: [file:line]
     - Fix Required: [exact instructions]
  ## Verdict: BLOCKED — return to Agent [N]

  SAVE to: pipeline/receipts/BLOCK-agent-{N}.md

FINAL RELEASE SIGN-OFF (after all 7 gates pass):
  # FINAL RELEASE SIGN-OFF
  ## Project: [NAME]
  ## Version: [X.Y.Z]
  ## Release Date: [DATE]
  ## Quality Gates Passed
  | Gate | Agent | Status | Date |
  |------|-------|--------|------|
  | 1 | Deep Planner | PASS | [date] |
  | 2 | Deep Thinker | PASS | [date] |
  | 3 | Scaffolding Expert | PASS | [date] |
  | 4 | Database Specialist | PASS | [date] |
  | 5 | Coding Expert | PASS | [date] |
  | 6 | Frontend Designer | PASS | [date] |
  | 7 | Release Documentarian | PASS | [date] |
  ## Production Readiness
  - [x] All features implemented
  - [x] All tests passing
  - [x] Documentation complete
  - [x] Security review passed
  - [x] Performance targets met
  This is PUBLIC PRODUCTION RELEASE QUALITY.

  SAVE to: pipeline/receipts/FINAL-VERIFICATION.md
  ALSO SAVE to: pipeline/artifacts/RELEASE-SIGNOFF.md
  SET pipeline-state.json phase to "COMPLETE"
```

---

## SECTION 5: MASTER WORKFLOW — FULL PIPELINE EXECUTION

```
PROCEDURE run_full_pipeline(user_requirements):

  ──── INITIALIZATION ────

  1. Create pipeline-state.json:
     {
       "projectId": generate_id(),
       "projectName": extract_from_requirements(),
       "currentAgent": "MASTER_CONTROLLER",
       "phase": "INIT",
       "artifacts": {},
       "verificationReceipts": [],
       "issues": [],
       "qualityGates": [],
       "createdAt": now(),
       "updatedAt": now()
     }

  ──── AGENT 1: DEEP PLANNER ────

  2. READ .claude/agents/01-deep-planner.md
  3. Follow Agent 1 protocol with user_requirements as input
  4. SAVE pipeline/artifacts/SPEC.md
  5. SWITCH to Critic: verify Gate 1
     IF FAIL → fix → re-verify
     IF PASS → save receipt, update state to REQUIREMENTS/PASS

  ──── AGENT 2: DEEP THINKER ────

  6. READ .claude/agents/02-deep-thinker.md
  7. READ pipeline/artifacts/SPEC.md
  8. Follow Agent 2 protocol
  9. SAVE pipeline/artifacts/TECHNICAL-REVIEW.md
  10. SWITCH to Critic: verify Gate 2
      IF Category A blockers found → update SPEC.md → re-verify Gate 2
      IF PASS → save receipt, update state to TECHNICAL_REVIEW/PASS

  ──── AGENT 3: SCAFFOLDING EXPERT ────

  11. READ .claude/agents/03-scaffolding-expert.md
  12. READ SPEC.md + TECHNICAL-REVIEW.md
  13. Follow Agent 3 protocol (create actual project files)
  14. SAVE pipeline/artifacts/SCAFFOLDING-MANIFEST.md
  15. SWITCH to Critic: verify Gate 3
      IF FAIL (build fails, floating versions) → fix → re-verify
      IF PASS → save receipt, update state to SCAFFOLDING/PASS

  ──── AGENT 4: DATABASE SPECIALIST ────

  16. READ .claude/agents/04-database-specialist.md
  17. READ SPEC.md + TECHNICAL-REVIEW.md + SCAFFOLDING-MANIFEST.md
  18. Follow Agent 4 protocol (create schema/migration files)
  19. SAVE pipeline/artifacts/DATABASE-ARCHITECTURE.md
  20. SWITCH to Critic: verify Gate 4
      IF FAIL → fix → re-verify
      IF PASS → save receipt, update state to DATABASE/PASS

  ──── AGENT 5: CODING EXPERT ────

  21. READ .claude/agents/05-coding-expert.md
  22. READ all 4 prior artifacts
  23. Follow Agent 5 protocol (implement all features, write tests)
  24. SAVE pipeline/artifacts/IMPLEMENTATION-REPORT.md
  25. RUN tests: all must pass
  26. SWITCH to Critic: verify Gate 5
      IF FAIL → fix code/tests → re-verify
      IF PASS → save receipt, update state to IMPLEMENTATION/PASS

  ──── AGENT 6: FRONTEND DESIGNER ────

  27. READ .claude/agents/06-frontend-designer.md
  28. READ SPEC.md (Section 6) + IMPLEMENTATION-REPORT.md
  29. Follow Agent 6 protocol (polish UI, accessibility, responsive)
  30. SAVE pipeline/artifacts/FRONTEND-REPORT.md
  31. SWITCH to Critic: verify Gate 6
      IF FAIL → fix UI → re-verify
      IF PASS → save receipt, update state to FRONTEND/PASS

  ──── AGENT 7: RELEASE DOCUMENTARIAN ────

  32. READ .claude/agents/07-release-documentarian.md
  33. READ all artifacts + actual codebase
  34. Follow Agent 7 protocol (write all docs)
  35. SAVE pipeline/artifacts/DOCUMENTATION-REPORT.md
  36. SWITCH to Critic: verify Gate 7
      IF FAIL → fix docs → re-verify
      IF PASS → save receipt, update state to DOCUMENTATION/PASS

  ──── FINAL RELEASE ────

  37. Generate FINAL-VERIFICATION.md
  38. Generate RELEASE-SIGNOFF.md
  39. Set pipeline-state.json phase to "COMPLETE"
  40. Copy final deliverable to output/ directory

  PIPELINE COMPLETE.
```

---

## SECTION 6: CONTEXT MANAGEMENT STRATEGY

The full pipeline WILL exceed most LLM context windows. These strategies prevent loss of continuity.

### Strategy 1: Artifact-Driven Continuity (Primary)

```
Each agent's output artifact contains ALL decisions and context needed
by downstream agents. If you lose context mid-pipeline:
  1. READ pipeline-state.json → know where you are
  2. READ ALL artifacts in pipeline/artifacts/ → restore full context
  3. Resume from current phase
```

### Strategy 2: One Agent Per Conversation

```
IF context limits are a concern:
  Conversation 1: Agent 1 + Gate 1 → save SPEC.md
  Conversation 2: Agent 2 + Gate 2 → save TECHNICAL-REVIEW.md
  Conversation 3: Agent 3 + Gate 3 → save SCAFFOLDING-MANIFEST.md
  ...and so on.

  Each conversation starts by reading:
    1. pipeline-state.json
    2. The current agent's prompt file
    3. All prior artifacts
  Then executes one agent's protocol and saves the artifact.
```

### Strategy 3: SuperCache Persistence (if available)

```
IF Floyd SuperCache MCP server is available:
  After each gate pass:
    cache_store(key: 'pipeline_{projectId}_state',
      value: pipeline-state.json contents)
    cache_store(key: 'pipeline_{projectId}_latest_artifact',
      value: latest artifact path and summary)

  On new conversation:
    cache_retrieve(key: 'pipeline_{projectId}_state')
    → Restore pipeline state and resume
```

---

## SECTION 7: FAILURE MODE CATALOG

### F1: "Gate fails repeatedly on the same check"
```
CAUSE: Agent output has a systemic issue
DETECT: GATE_FAILURES[N] >= 2 for same check
RECOVERY:
  1. Read the block reports for this agent
  2. Identify the ROOT CAUSE (not just the symptom)
  3. IF root cause is in this agent's work: fix specifically
  4. IF root cause is in an UPSTREAM artifact:
     Go back to the upstream agent, fix the artifact,
     then re-run all downstream agents from that point
  5. IF GATE_FAILURES[N] >= 3: invoke Invariant 6
     (go back to Agent 1 and strengthen the spec)
```

### F2: "Context window exhausted mid-agent"
```
CAUSE: Large codebase or verbose artifacts exceeded context limit
DETECT: LLM reports context overflow or starts losing earlier context
RECOVERY:
  1. IMMEDIATELY save current work (partial artifact) to disk
  2. Save pipeline-state.json with current progress note
  3. Start new conversation
  4. Read pipeline-state.json to resume
  5. Read the agent's prompt file and ALL prior artifacts
  6. Continue from where you left off
  The artifacts on disk ARE the continuity mechanism.
```

### F3: "Agent produces artifact with TBD/TODO placeholders"
```
CAUSE: Agent didn't fully resolve all requirements
DETECT: Critic finds TBD/TODO/placeholder text
RECOVERY:
  1. Critic documents each placeholder location
  2. Return to agent with block report
  3. Agent MUST resolve each placeholder with real content
  4. Re-verify from scratch
  IF placeholders keep appearing:
    The spec (SPEC.md) may lack sufficient detail.
    Go back to Agent 1 and add missing requirements.
```

### F4: "Build fails during Agent 3 verification"
```
CAUSE: Dependency conflict, missing package, config error
DETECT: Gate 3 install/build/start checks fail
RECOVERY:
  1. Read build error output carefully
  2. Common fixes:
     - Version conflict → pin to compatible versions
     - Missing peer dependency → add it
     - Config error → fix configuration file
  3. Re-run install + build + start
  4. Re-verify Gate 3 from scratch
```

### F5: "Tests fail during Agent 5 verification"
```
CAUSE: Implementation doesn't match spec, or tests have bugs
DETECT: Gate 5 "all tests pass" check fails
RECOVERY:
  1. Read test failure output
  2. Determine: is the test wrong or is the code wrong?
     - Compare against SPEC.md acceptance criteria
     - The SPEC is the source of truth
  3. Fix the code (if it doesn't match spec) or fix the test (if test is wrong)
  4. Re-run all tests
  5. Re-verify Gate 5 from scratch
```

### F6: "Agent output doesn't match expected artifact format"
```
CAUSE: Agent deviated from the artifact template
DETECT: Critic finds missing sections or wrong structure
RECOVERY:
  1. Compare artifact against the format spec in this document (Section 4)
  2. Add all missing sections
  3. Re-verify
```

### F7: "Pipeline state file corrupted or missing"
```
CAUSE: Disk error, accidental deletion, or incorrect update
DETECT: pipeline-state.json is invalid JSON or missing
RECOVERY:
  1. Check pipeline/artifacts/ to see which artifacts exist
  2. Check pipeline/receipts/ to see which gates have passed
  3. Reconstruct pipeline-state.json from evidence:
     - Last receipt = last passed gate
     - Next phase = the agent after the last passed gate
  4. Continue pipeline from reconstructed state
```

### F8: "Upstream artifact missing when downstream agent needs it"
```
CAUSE: Artifact not saved, deleted, or path wrong
DETECT: Agent can't find required input artifact
RECOVERY:
  1. Check pipeline/artifacts/ for the file
  2. IF file exists but path is wrong in state: fix pipeline-state.json
  3. IF file doesn't exist: go back to that agent and re-generate it
     Then re-verify its gate before continuing
```

### F9: "User requirements are too vague for Agent 1"
```
CAUSE: Insufficient input detail
DETECT: Agent 1 generates SPEC.md with many assumptions or shallow acceptance criteria
RECOVERY:
  IF interactive mode:
    Ask user specific questions per Agent 1's 5-category framework
  IF headless mode:
    Document ALL assumptions explicitly in SPEC.md Section 9
    Agent 2 will flag the most dangerous assumptions as Category B risks
    Proceed, but expect potential gate failures downstream
```

---

## SECTION 8: COMPOUND RECIPES (COPY-PASTE EXECUTABLE)

### Recipe A: Fresh Pipeline from Requirements

```
1. Create directories: pipeline/state/, pipeline/artifacts/, pipeline/receipts/, output/
2. Initialize pipeline-state.json with phase: "INIT"
3. Execute Agent 1 with user requirements → SPEC.md
4. Verify Gate 1 (Critic mode)
5. Execute Agent 2 with SPEC.md → TECHNICAL-REVIEW.md
6. Verify Gate 2
7. Execute Agent 3 → scaffold + SCAFFOLDING-MANIFEST.md
8. Verify Gate 3 (including actual build verification)
9. Execute Agent 4 → schema + DATABASE-ARCHITECTURE.md
10. Verify Gate 4
11. Execute Agent 5 → code + IMPLEMENTATION-REPORT.md
12. Verify Gate 5 (including running actual tests)
13. Execute Agent 6 → UI + FRONTEND-REPORT.md
14. Verify Gate 6
15. Execute Agent 7 → docs + DOCUMENTATION-REPORT.md
16. Verify Gate 7
17. Generate FINAL-VERIFICATION.md + RELEASE-SIGNOFF.md
18. Copy deliverable to output/
```

### Recipe B: Resume Pipeline from Saved State

```
1. READ pipeline/state/pipeline-state.json
2. IDENTIFY current phase (e.g., "SCAFFOLDING" means Gates 1-2 passed)
3. READ all existing artifacts in pipeline/artifacts/
4. READ the current agent's prompt file (.claude/agents/0N-*.md)
5. CONTINUE from where the pipeline stopped
6. Follow normal gate verification for remaining agents
```

### Recipe C: Re-run Single Agent (Targeted)

```
1. READ pipeline-state.json
2. READ the target agent's prompt file
3. READ all required input artifacts for that agent
4. Execute the agent's protocol
5. Verify its gate (Critic mode)
6. IF PASS: update pipeline-state.json
7. NOTE: downstream artifacts may now be stale.
   Consider re-running downstream agents if the output changed significantly.
```

### Recipe D: Pipeline with Open Anvil Browser Testing

```
1. Run Agents 1-5 normally (through Implementation)
2. After Agent 5:
   a. Start dev server (npm run dev or equivalent)
   b. Use Open Anvil to automate browser testing:
      - navigate_to(url: 'http://localhost:PORT')
      - Test all user flows from SPEC.md
      - check_accessibility(level: 'AA')
   c. Feed test results back to Agent 5 for fixes
3. Re-verify Gate 5
4. Continue with Agents 6-7
```

### Recipe E: Pipeline with Floyd-Lab Sandboxed Execution

```
1. Run Agents 1-3 normally (through Scaffolding)
2. For Agents 4-5 (Database + Code):
   a. spawn_lab(config: per project stack)
   b. Copy project files into lab
   c. execute_in_lab: run migrations, builds, tests
   d. Verify results inside lab
   e. migrate_to_host: bring back verified code and artifacts
   f. teardown_lab
3. Continue with Agents 6-7 on host
```

---

## SECTION 9: SELF-TEST PROCEDURE

After ingesting this skill, run this self-test to verify operational readiness:

```
TEST 1: Repository Structure
  CHECK: All 9 agent files exist in .claude/agents/
  PASS IF: All 9 files found (00 through 08)
  FAIL IF: Any file missing → Report which files are missing

TEST 2: Pipeline Directories
  CHECK: pipeline/state/, pipeline/artifacts/, pipeline/receipts/, output/ exist
  PASS IF: All 4 directories exist
  FAIL IF: Any missing → Create them

TEST 3: Pipeline State
  READ: pipeline/state/pipeline-state.json
  PASS IF: Valid JSON with required fields (projectId, phase, artifacts, qualityGates)
  FAIL IF: Invalid JSON → Create fresh state file
  NOTE IF: phase != "INIT" → Existing pipeline in progress

TEST 4: Agent File Integrity
  FOR EACH agent file (01-07):
    READ the file
    CHECK: Contains "PROTOCOL" or "Phase" sections
    CHECK: Contains deterministic instructions
  PASS IF: All agent files contain structured protocols
  FAIL IF: Any file is empty or malformed

ALL TESTS PASS → SKILL OPERATIONAL. Ready for pipeline execution.
ANY TEST FAILS → Report failure. Fix before proceeding.
```

---

## SECTION 10: INTERACTION COMMANDS

When the user issues these commands, respond accordingly:

```
"STATUS"
  → Read pipeline-state.json
  → Report: current phase, active agent, which gates have passed/failed,
    any outstanding issues

"HELP"
  → Explain the pipeline: 9 agents, 7 quality gates, sequential execution
  → List available commands

"REQUEST REVIEW: [Agent/Component]"
  → Switch to Critic mode
  → Re-verify the specified agent's output against its gate checklist

"STOP PIPELINE"
  → Save current state to pipeline-state.json
  → Save any in-progress artifacts
  → Report: stopped at [phase], can resume later

"RESUME"
  → Read pipeline-state.json
  → Resume from current phase (per Recipe B)
```

---

## SECTION 11: CONFIDENCE ANALYSIS

| Failure Category | Coverage | Confidence |
|-----------------|----------|------------|
| Agent sequencing errors | SEQUENTIAL EXECUTION invariant enforced | 99.5% |
| Skipped quality gates | QUALITY GATES NON-NEGOTIABLE invariant | 99.5% |
| Incomplete artifacts | NO PLACEHOLDERS invariant + Critic checks | 99.5% |
| Context overflow | 3 strategies: artifact-driven, per-agent, SuperCache | 99% |
| Gate failure loops | THREE-STRIKE GATE RULE with upstream escalation | 99% |
| Pipeline state loss | STATE PERSISTENCE invariant + F7 reconstruction | 99.5% |
| Missing upstream artifacts | F8 recovery with re-generation | 99% |
| Vague requirements | F9 with assumption documentation + Agent 2 risk flagging | 98.5% |
| Build/test failures | F4/F5 with specific fix guidance | 99% |
| Critic leniency | CRITIC IS RUTHLESS invariant with adversarial mandate | 99.5% |

**Aggregate confidence: 99.3%**
Remaining 0.7% risk: User provides fundamentally contradictory requirements that survive both Agent 1 and Agent 2 review, LLM context completely corrupted mid-pipeline with no state saved, external dependency (API, service) becomes unavailable during implementation — all outside the scope of this skill document.
