# Project Specification: FLOYD Anvil — Agentic Workflow Architect (HTML Artifact)

## 1. Executive Summary
A single self-contained HTML file that acts as the "FLOYD - The Anvil" Agentic Workflow Architect. The page guides an end user through a structured 12-point intake form, gathers all required information about their desired agentic workflow, then generates a complete, copy-paste-ready prompt. That prompt, when fed to Claude or another LLM, will produce all necessary folders, files, configuration, hooks, and state management to stand up the user's specified agentic workflow from scratch.

## 2. User Personas

### Primary: Solo Developer / AI Power User
- **Goal**: Quickly scaffold a production-grade agentic workflow without manually writing system prompts, state schemas, hook logic, or folder structures.
- **Pain Point**: Writing comprehensive agent prompts is tedious, error-prone, and requires deep knowledge of state persistence, failure recovery, and hook patterns.
- **Skill Level**: Technical enough to use an LLM and paste prompts, but may not know best practices for agentic architecture.

### Secondary: Team Lead / Architect
- **Goal**: Standardize agentic workflow creation across a team.
- **Pain Point**: Inconsistent agent definitions, missing safety hooks, no rollback strategy.

## 3. Functional Requirements

### 3.1 Core Features

- [ ] **F1: Multi-Step Intake Wizard** — A guided, multi-step form that walks the user through the 12-point FLOYD intake protocol:
  1. Scenario Name (text input)
  2. Objective (verb-led, text input with helper examples)
  3. Environment (dropdown: Claude Code, GitHub Actions, Notion, Custom + text)
  4. Autonomy Mode (radio: A=Human-in-Loop, B=Semi-Autonomous, C=Fully Autonomous)
  5. Risk Level (radio: Low, Medium, High)
  6. Tools Available (multi-select checkboxes + custom text input)
  7. Inputs (textarea: what data/files the agent receives)
  8. Expected Outputs (textarea: what the agent must produce)
  9. Hard Stops (textarea: conditions where the agent must halt)
  10. Success Checks (textarea: how to verify the agent succeeded)
  11. Heartbeat/State Store (conditional — shown only for B/C autonomy; text input for store type)
  12. Hooks (conditional — shown only for B/C autonomy or High risk; checkboxes: Ralph-Wiggams, Budget, Safety, Escalation + custom)
  - **Acceptance**: Each step validates before allowing "Next". Back navigation works. Progress indicator visible.

- [ ] **F2: Conditional Logic** — Steps 11 and 12 appear only when Autonomy Mode is B or C, or Risk Level is High.
  - **Acceptance**: Selecting Autonomy A + Risk Low skips steps 11-12. Changing back re-shows them.

- [ ] **F3: Real-Time Validation** — Each field validates on blur and on "Next" click. Required fields show inline errors. No empty required fields pass.
  - **Acceptance**: Submitting an empty "Scenario Name" shows "Required" error inline. Clearing it and typing removes the error.

- [ ] **F4: Intake Summary Review** — After completing the wizard, show a full summary table of all answers in a review panel before generation.
  - **Acceptance**: User can see all 10-12 answers at once, edit any by clicking back to that step.

- [ ] **F5: Prompt Generation Engine** — On "Generate" click, produce a complete structured prompt containing:
  1. **Intake Summary Table** (SOT) — the user's confirmed requirements
  2. **Deterministic Prompt Pack** — System prompt with role, mission, THOUGHT/ACTION/OBSERVATION/EVIDENCE/STATE_UPDATE cycle, hard stops, command set
  3. **Agent Spec** — Name, persona, permissions matrix, environment config
  4. **Workflow Spec (The Anvil)** — State schema (JSON), heartbeat routine (if B/C), rollback strategy, hook definitions (Ralph-Wiggams, Budget, Safety, Escalation), folder/file tree to create
  - **Acceptance**: Generated prompt is >2000 chars, includes all 4 sections, references user's exact inputs, includes folder structure with mkdir/touch commands.

- [ ] **F6: Copy-to-Clipboard** — Single button copies the entire generated prompt to clipboard with visual confirmation.
  - **Acceptance**: Clicking "Copy" puts text on clipboard. Button changes to "Copied!" for 2 seconds.

- [ ] **F7: Reset / Start Over** — Button clears all form state and returns to Step 1.
  - **Acceptance**: All fields cleared, progress resets to Step 1.

### 3.2 User Interactions & Flows

**Flow 1: Happy Path (Autonomous Agent)**
1. User opens HTML file in browser
2. Sees welcome/hero screen with "Begin" button
3. Steps through 12 intake fields (B/C mode selected, so 11-12 appear)
4. Reviews summary
5. Clicks "Generate Anvil"
6. Sees generated prompt in a styled output panel
7. Clicks "Copy to Clipboard"
8. Pastes into Claude/LLM

**Flow 2: Minimal Path (Simple Agent)**
1. User opens HTML file
2. Steps through 10 intake fields (A mode + Low risk, so 11-12 are skipped)
3. Reviews summary (10 items)
4. Generates prompt (no heartbeat/hooks sections)
5. Copies

**Flow 3: Edit & Regenerate**
1. User generates prompt
2. Clicks "Edit Answers"
3. Returns to wizard with state preserved
4. Changes a field
5. Re-generates

### 3.3 Data Model (In-Memory)

```
IntakeState {
  scenarioName: string (required, min 3 chars)
  objective: string (required, must start with a verb)
  environment: string (required, one of predefined + custom)
  autonomyMode: enum "A" | "B" | "C" (required)
  riskLevel: enum "Low" | "Medium" | "High" (required)
  tools: string[] (required, at least 1)
  inputs: string (required)
  outputs: string (required)
  hardStops: string (required)
  successChecks: string (required)
  heartbeatStore: string (conditional, required if autonomy B/C)
  hooks: string[] (conditional, required if autonomy B/C or risk High)
  currentStep: number (1-12)
  isComplete: boolean
}
```

### 3.4 API Requirements
None. This is a fully client-side, single-file HTML artifact. No server calls.

### 3.5 Edge Cases & Error Handling

- **Case 1**: User tries to navigate forward without filling required field → Show inline error, block navigation.
- **Case 2**: User selects Autonomy A then switches to B mid-wizard → Steps 11-12 become required, wizard extends.
- **Case 3**: User switches from B back to A after filling steps 11-12 → Steps 11-12 data is preserved but hidden; not included in generated prompt.
- **Case 4**: Browser has JavaScript disabled → Show `<noscript>` message.
- **Case 5**: User on mobile device → Layout must be responsive and usable on 375px+ screens.

## 4. Non-Functional Requirements

### 4.1 Performance
- Page load under 1 second (no external fetches required beyond optional font CDN)
- Prompt generation under 100ms
- Smooth 60fps animations on step transitions

### 4.2 Security
- No data leaves the browser. Zero network requests for data.
- No localStorage/cookies (ephemeral by design — state lives only in JS memory)
- XSS safe: all user input is escaped before rendering in the output prompt

### 4.3 Scalability
- N/A — single-user, client-side

### 4.4 Accessibility
- Semantic HTML5 form elements
- ARIA labels on all interactive elements
- Keyboard navigable (Tab, Enter, Escape)
- Color contrast ratio 4.5:1+
- Focus rings visible on all interactive elements

## 5. Technical Architecture

### 5.1 Technology Stack
- **Frontend**: Single HTML file, embedded CSS, embedded JavaScript (vanilla, no frameworks)
- **Fonts**: Inter via Google Fonts CDN (with system font fallback)
- **Icons**: Inline SVG (no icon library dependency)

### 5.2 Project Structure
```
output/
└── floyd-anvil.html    (single self-contained file)
```

## 6. Visual & UX Specification

### 6.1 Design Language
- **Style**: Enterprise Dark — professional, high-contrast, command-center aesthetic
- **Color Palette**:
  - Background: #0a0e17 (deep navy-black)
  - Surface: #131a2b (card surface)
  - Surface Hover: #1a2340
  - Primary Accent: #3b82f6 (blue)
  - Secondary Accent: #8b5cf6 (purple)
  - Success: #10b981 (emerald)
  - Warning: #f59e0b (amber)
  - Error: #ef4444 (red)
  - Text Primary: #e2e8f0
  - Text Secondary: #94a3b8
  - Border: #1e293b
- **Typography**:
  - Font: Inter, system-ui, -apple-system, sans-serif
  - Heading 1: 2rem / 700
  - Heading 2: 1.5rem / 600
  - Body: 0.95rem / 400
  - Caption: 0.8rem / 400
- **Spacing**: 4px base unit (4, 8, 12, 16, 24, 32, 48)
- **Border Radius**: 8px default, 12px for cards, 6px for inputs
- **Shadows**: Subtle blue-tinted glow on focused elements

### 6.2 Component Library
- **ProgressBar**: Horizontal steps indicator with numbered circles, active/complete/pending states
- **StepPanel**: Animated card that slides in from right on forward, left on back
- **TextInput**: Dark input with border glow on focus, inline error below
- **TextArea**: Same as TextInput but multiline, auto-resize
- **RadioGroup**: Styled radio buttons with card-style selection
- **CheckboxGroup**: Styled checkboxes with labels
- **Dropdown**: Custom-styled select
- **Button**: Primary (blue gradient), Secondary (outlined), Danger (red)
- **SummaryTable**: Two-column table with zebra striping
- **OutputPanel**: Monospace code block with syntax-style coloring
- **CopyButton**: Button with clipboard icon, "Copied!" state

### 6.3 Responsive Breakpoints
- Mobile: 375px — single column, full-width cards
- Tablet: 768px — slightly wider cards, same layout
- Desktop: 1024px+ — centered card container, max-width 800px

## 7. Success Criteria
- User can complete the wizard in under 3 minutes
- Generated prompt is immediately usable (paste into LLM, get working scaffold)
- Generated prompt includes all 4 FLOYD output sections
- All conditional logic works correctly
- Copy to clipboard works in Chrome, Safari, Firefox
- Page renders correctly on mobile, tablet, desktop
- Zero JavaScript errors in console

## 8. Out of Scope
- Server-side storage
- User accounts / authentication
- Multi-language / i18n
- Export to file (beyond clipboard)
- Direct LLM API integration

## 9. Assumptions
- User has a modern browser (Chrome 90+, Safari 14+, Firefox 88+)
- User understands what an "agentic workflow" is
- User will paste the generated prompt into an LLM that supports tool use
- The generated prompt targets Claude Code as the primary consumer, but is LLM-agnostic
