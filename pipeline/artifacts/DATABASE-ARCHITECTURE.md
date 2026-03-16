# Database Architecture: FLOYD Anvil (In-Memory State)

## Schema: IntakeState (JavaScript Object)

```javascript
const INITIAL_STATE = {
  // Step 1
  scenarioName: '',
  // Step 2
  objective: '',
  // Step 3
  environment: '',
  environmentCustom: '',
  // Step 4
  autonomyMode: '', // 'A' | 'B' | 'C'
  // Step 5
  riskLevel: '', // 'Low' | 'Medium' | 'High'
  // Step 6
  tools: [],       // array of selected tool strings
  toolsCustom: '', // custom tool text
  // Step 7
  inputs: '',
  // Step 8
  outputs: '',
  // Step 9
  hardStops: '',
  // Step 10
  successChecks: '',
  // Step 11 (conditional: autonomy B/C)
  heartbeatStore: '',
  // Step 12 (conditional: autonomy B/C OR risk High)
  hooks: [],         // array of selected hook strings
  hooksCustom: '',   // custom hook text
};
```

## Wizard Navigation State

```javascript
const WIZARD_STATE = {
  currentStep: 1,        // 1-based index into VISIBLE steps
  totalSteps: 10,        // dynamically computed: 10, 11, or 12
  visibleSteps: [],      // ordered array of step IDs based on conditions
  isReviewMode: false,   // true when showing summary
  isOutputMode: false,   // true when showing generated prompt
  errors: {},            // { fieldName: 'Error message' }
};
```

## Conditional Visibility Logic

```javascript
function computeVisibleSteps(state) {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const needsHeartbeat = state.autonomyMode === 'B' || state.autonomyMode === 'C';
  const needsHooks = needsHeartbeat || state.riskLevel === 'High';
  if (needsHeartbeat) base.push(11);
  if (needsHooks) base.push(12);
  return base;
}
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| scenarioName | required, min 3 chars | "Scenario name must be at least 3 characters" |
| objective | required, min 10 chars | "Objective must be at least 10 characters. Start with a verb." |
| environment | required, non-empty | "Select an environment" |
| autonomyMode | required, one of A/B/C | "Select an autonomy mode" |
| riskLevel | required, one of Low/Medium/High | "Select a risk level" |
| tools | required, at least 1 selected | "Select at least one tool" |
| inputs | required, min 10 chars | "Describe the inputs (at least 10 characters)" |
| outputs | required, min 10 chars | "Describe the expected outputs (at least 10 characters)" |
| hardStops | required, min 10 chars | "Define at least one hard stop condition" |
| successChecks | required, min 10 chars | "Define at least one success check" |
| heartbeatStore | required if visible, min 5 chars | "Specify the state store type" |
| hooks | required if visible, at least 1 | "Select at least one hook" |

## Data Access Patterns
- Read: Direct property access on state object
- Write: Setter function that validates + updates state + re-renders
- Reset: Replace state with copy of INITIAL_STATE

## Confidence Score
10/10 — Trivial data layer, no persistence needed.
