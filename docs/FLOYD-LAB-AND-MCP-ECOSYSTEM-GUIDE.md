# Floyd-Lab & MCP Ecosystem — Complete Operations Guide

> Floyd Labs MCP servers, the Floyd-Lab VM system, and the complete A-TEAM MCP ecosystem
> This document enables any single LLM (no sub-agent required) or human operator to understand, configure, and operate the full Floyd Labs toolchain.

---

## TABLE OF CONTENTS

1. [What Floyd Labs Is](#1-what-floyd-labs-is)
2. [MCP Architecture](#2-mcp-architecture)
3. [Floyd-Lab VM System](#3-floyd-lab-vm-system)
4. [A-TEAM MCP Server Inventory](#4-a-team-mcp-server-inventory)
5. [Floyd Labs Skills Catalog](#5-floyd-labs-skills-catalog)
6. [Configuration Reference](#6-configuration-reference)
7. [Floyd Boot Contract (FLOYD.md)](#7-floyd-boot-contract-floydmd)
8. [Optimal A-TEAM Usage Patterns](#8-optimal-a-team-usage-patterns)
9. [Human Operator Deployment Guide](#9-human-operator-deployment-guide)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. WHAT FLOYD LABS IS

Floyd Labs is a suite of MCP (Model Context Protocol) servers that provide an LLM with extended capabilities beyond its native tools. These servers run locally or remotely and expose tools via the MCP JSON-RPC 2.0 protocol.

The Floyd ecosystem provides:
- **Floyd-Lab** — Sandboxed MicroVM environments for executing code, running builds, and testing in isolation.
- **Floyd DevTools** — Development tools: API format verification, benchmark running, build error correlation, dependency analysis, git bisect, schema migration, test generation, TypeScript semantic analysis.
- **Floyd Runner** — Build, test, lint, and format execution across project types.
- **Floyd Safe-Ops** — Impact simulation, safe refactoring, and verification.
- **Floyd SuperCache** — Persistent project state caching across conversations.
- **Floyd Terminal** — Process management, code execution, file operations.
- **Floyd Patch** — Precise file editing: unified diff application, range editing, insertion, deletion.
- **Hivemind Orchestrator** — Multi-agent task coordination, consensus building.
- **Lab-Lead** — Tool discovery, server info, agent spawning.
- **Novel Concepts** — Advanced reasoning: context compression, analogy synthesis, concept weaving, consensus protocols, episodic memory, execution trace synthesis, refactoring orchestration, semantic diff validation.
- **Pattern Crystallizer** — Pattern detection, extraction, adaptation, and validation.
- **Omega-AGI** — Meta-cognitive system: reflection, learning, strategy, capability evolution.
- **Open Anvil** — Browser automation (see dedicated guide).
- **Context Singularity** — Codebase indexing, search, and semantic understanding.

---

## 2. MCP ARCHITECTURE

```
┌─────────────────┐
│   Claude Code    │
│   (or any LLM)  │
└────────┬────────┘
         │ MCP JSON-RPC 2.0 (stdio)
         │
    ┌────┴────────────────────────────────────────────┐
    │                MCP Server Layer                   │
    ├──────────────────────────────────────────────────┤
    │ floyd-lab         → VM management                │
    │ floyd-devtools    → Dev tools (9 tools)          │
    │ floyd-runner      → Build/test/lint/format       │
    │ floyd-safe-ops    → Safe refactoring             │
    │ floyd-supercache  → Persistent state             │
    │ floyd-terminal    → Process management           │
    │ floyd-patch       → File editing                 │
    │ hivemind          → Multi-agent coordination     │
    │ lab-lead          → Tool discovery               │
    │ novel-concepts    → Advanced reasoning           │
    │ pattern-crystal   → Pattern detection            │
    │ omega-agi         → Meta-cognition               │
    │ open-anvil        → Browser automation           │
    │ context-singular  → Codebase understanding       │
    └──────────────────────────────────────────────────┘
```

### MCP Protocol Basics

Every MCP server communicates via JSON-RPC 2.0 over stdio (stdin/stdout):

**Initialize:**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"claude-code"}}}
```

**List Tools:**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

**Call Tool:**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"tool_name","arguments":{"key":"value"}}}
```

**Response:**
```json
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"..."}]}}
```

---

## 3. FLOYD-LAB VM SYSTEM

Floyd-Lab provides sandboxed MicroVM environments for safe code execution, testing, and experimentation. It ensures that dangerous operations (file system modifications, network calls, package installations) happen in isolation, not on the host machine.

### Available Tools

| Tool | Description | Key Parameters |
|------|-------------|---------------|
| `spawn_lab` | Create a new sandboxed lab environment | `config` (environment specification) |
| `execute_in_lab` | Execute commands/code inside a running lab | `lab_id`, `command`, `timeout` |
| `migrate_to_host` | Migrate verified results from lab to host machine | `lab_id`, `artifacts` (what to bring back) |
| `teardown_lab` | Destroy a lab environment and clean up | `lab_id` |

### Operational Workflow

```
1. spawn_lab(config)          → Creates isolated environment
                                Returns lab_id
2. execute_in_lab(lab_id,     → Run commands inside the lab
   command)                     Returns output, exit code
3. [Verify results]           → Check that execution succeeded
4. migrate_to_host(lab_id,    → Bring verified artifacts back
   artifacts)                   to the host machine
5. teardown_lab(lab_id)       → Destroy the lab, free resources
```

### When to Use Floyd-Lab

| Scenario | Use Floyd-Lab? | Reason |
|----------|---------------|--------|
| Installing unknown npm packages | YES | May contain malicious scripts |
| Running untrusted code | YES | Sandbox prevents host damage |
| Testing database migrations | YES | Reversible in lab, irreversible on host |
| Building from source | YES | Build scripts may have side effects |
| Reading files | NO | Use native Read tool |
| Editing existing code | NO | Use native Edit tool |
| Running familiar test suites | MAYBE | Depends on test side effects |

### Lab Lifecycle Management

- Labs are ephemeral. They do NOT persist across conversations.
- Always `teardown_lab` when done to free resources.
- `migrate_to_host` is the ONLY way to get data out of a lab.
- If a lab times out or crashes, its state is lost. Use checkpoints within the lab if doing multi-step work.

### Best Practices

1. **Spawn before you need it.** Lab creation takes time. Start early.
2. **Execute incrementally.** Don't batch 50 commands into one `execute_in_lab` call. Execute step-by-step so you can catch failures early.
3. **Verify before migrating.** Always check execution results in the lab before moving artifacts to host.
4. **Clean up always.** `teardown_lab` after every workflow, even on failure.
5. **Use for risky operations only.** Don't route safe read operations through the lab — it adds latency.

---

## 4. A-TEAM MCP SERVER INVENTORY

These are the MCP servers available in the A-TEAM environment. Each server is configured in the MCP client settings (Claude Code, Claude Desktop, etc.).

### Floyd DevTools (9 tools)

| Tool | Purpose |
|------|---------|
| `api_format_verifier` | Verify API specs against OpenAPI/Swagger/RAML standards |
| `benchmark_runner` | Execute code benchmarks with statistical analysis |
| `build_error_correlator` | Correlate build errors across builds to find patterns |
| `dependency_analyzer` | Analyze project dependencies and find issues |
| `git_bisect` | Automated git bisect to find bug-introducing commits |
| `monorepo_dependency_analyzer` | Analyze cross-package dependencies in monorepos |
| `schema_migrator` | Generate database schema migrations with rollback plans |
| `secure_hook_executor` | Execute git hooks in sandboxed environment |
| `test_generator` | Automatically generate test cases |
| `typescript_semantic_analyzer` | Deep TypeScript semantic analysis |

### Floyd Runner (5 tools)

| Tool | Purpose |
|------|---------|
| `build` | Build the project |
| `run_tests` | Run project tests |
| `lint` | Run linter |
| `format` | Run code formatter |
| `detect_project` | Detect project type and available scripts |
| `check_permission` | Check if an operation is permitted |

### Floyd Safe-Ops (3 tools)

| Tool | Purpose |
|------|---------|
| `impact_simulate` | Simulate the impact of a change before applying |
| `safe_refactor` | Perform refactoring with safety checks |
| `verify` | Verify a change was applied correctly |

### Floyd SuperCache (11 tools)

| Tool | Purpose |
|------|---------|
| `cache_store` | Store data in persistent cache |
| `cache_retrieve` | Retrieve cached data |
| `cache_search` | Search across cached entries |
| `cache_delete` | Delete a cache entry |
| `cache_clear` | Clear all cache |
| `cache_list` | List all cache entries |
| `cache_stats` | Cache usage statistics |
| `cache_prune` | Remove stale entries |
| `cache_store_pattern` | Store a pattern to cache |
| `cache_store_reasoning` | Store reasoning chain to cache |
| `cache_load_reasoning` | Load reasoning chain from cache |
| `cache_archive_reasoning` | Archive reasoning for long-term storage |

### Floyd Terminal (8 tools)

| Tool | Purpose |
|------|---------|
| `execute_code` | Execute code in a managed environment |
| `start_process` | Start a long-running process |
| `read_process_output` | Read output from a running process |
| `interact_with_process` | Send input to a running process |
| `kill_process` | Kill a running process |
| `force_terminate` | Force terminate a process |
| `list_processes` | List all managed processes |
| `list_sessions` | List terminal sessions |
| `create_directory` | Create a directory |
| `get_file_info` | Get file metadata |

### Floyd Patch (5 tools)

| Tool | Purpose |
|------|---------|
| `apply_unified_diff` | Apply a unified diff patch |
| `assess_patch_risk` | Assess risk of applying a patch |
| `delete_range` | Delete a line range |
| `edit_range` | Edit a line range |
| `insert_at` | Insert text at a specific line |

### Hivemind Orchestrator (12 tools)

| Tool | Purpose |
|------|---------|
| `register_agent` | Register a new agent |
| `assign_tasks` | Assign tasks to agents |
| `submit_task` | Submit a new task |
| `claim_task` | Claim a task for execution |
| `complete_task` | Mark a task complete |
| `get_task_status` | Check task status |
| `list_tasks` | List all tasks |
| `send_message` | Send message between agents |
| `collaborate` | Initiate collaboration |
| `build_consensus` | Build consensus among agents |
| `send_heartbeat` | Agent heartbeat |
| `check_stale_agents` | Find unresponsive agents |
| `update_agent_status` | Update agent status |
| `get_stats` | Get orchestrator stats |

### Context Singularity (8 tools)

| Tool | Purpose |
|------|---------|
| `ingest_codebase` | Index an entire codebase |
| `ingest_file` | Index a single file |
| `search` | Semantic search across indexed code |
| `ask` | Ask questions about the codebase |
| `explain` | Get explanation of code |
| `find_impact` | Find impact of a change |
| `trace_origin` | Trace the origin of a pattern |
| `summarize_context` | Summarize codebase context |
| `get_stats` | Indexing statistics |
| `clear_index` | Clear the index |

### Novel Concepts (10 tools)

| Tool | Purpose |
|------|---------|
| `adaptive_context_compressor` | Compress context while preserving meaning |
| `analogy_synthesizer` | Generate analogies for complex concepts |
| `compute_budget_allocator` | Allocate compute budget across tasks |
| `concept_web_weaver` | Weave concept maps |
| `consensus_protocol` | Multi-agent consensus |
| `distributed_task_board` | Distributed task management |
| `episodic_memory_bank` | Store and retrieve episodic memories |
| `execution_trace_synthesizer` | Synthesize execution traces |
| `refactoring_orchestrator` | Orchestrate complex refactoring |
| `semantic_diff_validator` | Validate semantic correctness of diffs |

### Pattern Crystallizer (7 tools)

| Tool | Purpose |
|------|---------|
| `detect_and_crystallize` | Auto-detect and crystallize patterns |
| `extract_pattern` | Extract a specific pattern |
| `adapt_pattern` | Adapt a pattern to new context |
| `validate_pattern` | Validate a pattern applies correctly |
| `list_crystallized` | List all crystallized patterns |
| `store_episode` | Store an episode for pattern detection |
| `retrieve_episodes` | Retrieve stored episodes |

### Omega-AGI (7 tools)

| Tool | Purpose |
|------|---------|
| `reflect` | Self-reflection on actions and decisions |
| `learn` | Learn from experience |
| `strategize` | Develop strategies |
| `evolve` | Evolve capabilities |
| `rlm` | Reinforcement learning from memory |
| `get_capabilities` | List current capabilities |
| `get_history` | Review history |
| `adjudicate_conflict` | Resolve conflicts |

### Lab-Lead (5 tools)

| Tool | Purpose |
|------|---------|
| `lab_inventory` | List all available lab tools and servers |
| `lab_find_tool` | Find a specific tool by name or description |
| `lab_get_server_info` | Get info about a specific MCP server |
| `lab_get_tool_registry` | Get the full tool registry |
| `lab_spawn_agent` | Spawn a specialized agent |
| `lab_sync_knowledge` | Sync knowledge across agents |

---

## 5. FLOYD LABS SKILLS CATALOG

Floyd Labs provides 65+ skills accessible through a single proxy tool via MCP.

### Connection Configuration

**MCP Endpoint:**
```
POST https://floydslabs.com/api/mcp
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Claude Desktop Config:**
```json
{
  "mcpServers": {
    "floyd-labs": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-proxy"],
      "env": {
        "MCP_PROXY_URL": "https://floydslabs.com/api/mcp",
        "MCP_PROXY_HEADERS": "Authorization: Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Skill Categories

| Category | Count | Examples |
|----------|-------|---------|
| Reasoning | 4 | Analogy Synthesis, Consensus Algorithms, Meta Reasoning, MIT Analysis |
| Analysis | 5 | Performance Profiling, Semantic Diff Validation, Tarjan Dependency Detection, Cognitive Load Analysis |
| Patterns | 3 | API Contract Validation, Test Generation Patterns, Pattern Extraction |
| Workflows | 1 | Code Review Workflow |
| General | 52+ | Agent Orchestration (16), Context Management (7), Knowledge (6), Patterns (2), Dev Tools (10), Visualization (3), Meta-Cognition (2), Ethics/Quality (2), Infrastructure (2) |

### API Usage

**List all skills:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"floyd","arguments":{"action":"list"}}}
```

**Describe a skill:**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"floyd","arguments":{"action":"describe","skill":"git-bisect"}}}
```

**Execute a skill:**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"floyd","arguments":{"action":"execute","skill":"concept-crystallization","args":{"action":"crystallize","concept":"microservices architecture"}}}}
```

### Key Skills for A-TEAM Usage

| Skill | When to Use |
|-------|-------------|
| `concept-crystallization` | Agent 1: Crystallize vague requirements into precise definitions |
| `semantic-diff-validation` | Agent 5/8: Validate code changes don't break semantic contracts |
| `test-generation-patterns` | Agent 5: Generate test cases from spec |
| `code-review-workflow` | Agent 8: Structured code review |
| `git-bisect` | Debugging: find which commit introduced a bug |
| `schema-migrator` | Agent 4: Generate safe database migrations |
| `api-contract-validation` | Agent 5: Validate API implementation matches spec |
| `quality-scoring` | Agent 8: 140-point quality evaluation |

---

## 6. CONFIGURATION REFERENCE

### Claude Code Project Settings

File: `.claude/settings.json`
```json
{
  "model": "claude-opus-4-6",
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "Agent"]
  }
}
```

### MCP Server Configuration

MCP servers are configured in your LLM client's MCP settings. For Claude Code, this is typically `~/.claude/mcp_servers.json` or added via `claude mcp add`.

**Example configuration for the full stack:**
```json
{
  "open-anvil": {
    "command": "node",
    "args": ["/path/to/open-anvil/mcp-server/server.js"],
    "env": { "ANVIL_PORT": "7777" }
  },
  "floyd-devtools": {
    "command": "node",
    "args": ["/path/to/floyd-devtools/server.js"]
  },
  "floyd-lab": {
    "command": "node",
    "args": ["/path/to/floyd-lab/server.js"]
  },
  "floyd-runner": {
    "command": "node",
    "args": ["/path/to/floyd-runner/server.js"]
  },
  "floyd-safe-ops": {
    "command": "node",
    "args": ["/path/to/floyd-safe-ops/server.js"]
  },
  "floyd-supercache": {
    "command": "node",
    "args": ["/path/to/floyd-supercache/server.js"]
  },
  "floyd-terminal": {
    "command": "node",
    "args": ["/path/to/floyd-terminal/server.js"]
  },
  "floyd-patch": {
    "command": "node",
    "args": ["/path/to/floyd-patch/server.js"]
  }
}
```

---

## 7. FLOYD BOOT CONTRACT (FLOYD.md)

The `FLOYD.md` file at the repository root is the boot contract — read by the LLM on every initialization.

### Key Directives

1. **Project Sovereignty** — All persistent state in `./.floyd/.supercache`. No cross-project memory leaking.
2. **Read Before Edit** — Always verify file paths and content before modifying.
3. **Deterministic Reasoning** — Use `<think>` blocks for complex architectural planning.
4. **Surgical Edits** — Use precise modification tools, not full file rewrites.
5. **Code Integrity** — All code production-ready. Handle nil/zero/empty inputs.
6. **Context Expiry** — Flush intermediate data after completing major tasks.
7. **No Ceremony** — Zero filler. Output results immediately.
8. **Mermaid Diagrams** — All architectural diagrams in Mermaid syntax.
9. **Semantic Commits** — `feat:`, `fix:`, `chore:`. Never force push.

### Initialization Routine

Upon starting, the LLM must:
1. Ensure `./.floyd/` and `./.floyd/.supercache` exist.
2. Query MCP registry for available tools.
3. Load last known intent from cache.
4. Output 3-line boot summary:
   - Active Project: [Name]
   - Last Known Status: [Status]
   - Current Intent: [Intent]

---

## 8. OPTIMAL A-TEAM USAGE PATTERNS

### Pattern 1: Full Pipeline Run (New Project)

```
1. User provides detailed requirements
2. Pipeline runs agents 1→7 sequentially
3. Each gate verified by Critic
4. Output in output/ directory
5. Total: 7 artifacts + receipts + deliverable
```

**Best for:** New projects where you want rigorous quality. Budget: full conversation.

### Pattern 2: Targeted Agent Run (Specific Task)

```
1. User has an existing project
2. User wants only specific agent(s) to run
3. Example: "Run Agent 6 (Frontend) on my existing app"
4. Feed the agent its required input artifacts
5. Get focused output
```

**Best for:** Adding UI polish to existing code, generating docs for existing project, or doing a technical review of an existing spec.

### Pattern 3: Pipeline with Open Anvil Testing

```
1. Run agents 1→5 (through implementation)
2. Deploy to local dev server
3. Use Open Anvil for automated browser testing
4. Feed test results back to Agent 5 for fixes
5. Continue with agents 6→7
```

**Best for:** Web applications where browser testing catches bugs that unit tests miss.

### Pattern 4: Floyd-Lab Sandboxed Development

```
1. Run agents 1→3 (through scaffolding)
2. spawn_lab for Agent 4→5 work (database + code)
3. execute_in_lab for builds and tests
4. migrate_to_host verified artifacts
5. teardown_lab
6. Continue with agents 6→7 on host
```

**Best for:** Projects with risky dependencies or database operations.

### Pattern 5: SuperCache Continuity

```
1. Run agents 1→3 in conversation A
2. cache_store pipeline state + artifacts
3. [New conversation B]
4. cache_retrieve pipeline state
5. Resume from Agent 4
```

**Best for:** Long projects that exceed a single conversation's context window.

### Tool Selection Guide

| Task | Best Tool |
|------|-----------|
| Read a file | Native `Read` tool (not Floyd) |
| Edit a file | Native `Edit` tool (not Floyd) |
| Search codebase | Native `Grep`/`Glob` (not Floyd) |
| Run shell command | Native `Bash` (not Floyd) |
| Browser automation | Open Anvil |
| Risky code execution | Floyd-Lab |
| Build/test/lint | Floyd Runner |
| Persist state across convos | Floyd SuperCache |
| Find patterns in code | Pattern Crystallizer |
| Understand codebase | Context Singularity |
| Multi-agent coordination | Hivemind Orchestrator |
| Self-improvement | Omega-AGI |

**Rule of thumb:** Use native Claude Code tools for simple operations. Use MCP servers for specialized capabilities that native tools don't provide.

---

## 9. HUMAN OPERATOR DEPLOYMENT GUIDE

### 9.1 Deploying the Full A-TEAM with All MCP Servers

**Step 1: Install Node.js 20+**
```bash
# macOS
brew install node@20

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # Should be v20.x.x+
npm --version
```

**Step 2: Clone and Set Up A-TEAM**
```bash
git clone <repo-url> A-TEAM
cd A-TEAM

# Install Open Anvil MCP server
cd open-anvil/mcp-server && npm install && cd ../..

# Create pipeline directories
mkdir -p pipeline/state pipeline/artifacts pipeline/receipts output
```

**Step 3: Install Claude Code**
```bash
npm install -g @anthropic-ai/claude-code
```

**Step 4: Configure MCP Servers**

Add Open Anvil to Claude Code:
```bash
claude mcp add open-anvil --transport stdio --scope user -- \
  node /absolute/path/to/A-TEAM/open-anvil/mcp-server/server.js
```

**Step 5: Load Chrome Extension (if using Open Anvil)**
1. Open Chrome → `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select `A-TEAM/open-anvil/extension/`

**Step 6: Run the Pipeline**
```bash
cd A-TEAM
claude
# Then provide your project requirements
```

### 9.2 Running Without Claude Code (Generic LLM)

If using a different LLM, you need to:

1. Configure MCP servers in your LLM client's settings.
2. Manually feed agent prompts from `.claude/agents/` as system context.
3. Follow the pipeline steps in order (see Section 8 of the A-TEAM Pipeline Guide).

### 9.3 Headless/Non-Interactive Operation

For fully automated pipeline runs without human input:

1. **Prepare a comprehensive requirements document** — Agent 1 normally asks questions. If you provide exhaustive requirements upfront, it can generate the spec without asking.

2. **Use the single-LLM protocol** from Section 11 of the A-TEAM Pipeline Guide.

3. **Set Claude Code to auto-approve mode** if you trust the pipeline:
   ```bash
   claude --dangerously-skip-permissions
   ```
   **WARNING:** This skips all permission prompts. Only use in controlled environments.

4. **Monitor via pipeline-state.json:**
   ```bash
   watch -n 5 cat pipeline/state/pipeline-state.json
   ```

---

## 10. TROUBLESHOOTING

### MCP server not found
- Verify the server path is absolute in your MCP config.
- Verify the server file exists and is executable.
- Check: `node /path/to/server.js --help` (should not error).

### MCP server crashes on startup
- Check stderr output for error messages.
- Common cause: missing `node_modules/` — run `npm install` in the server directory.
- Common cause: wrong Node.js version — need 20+.

### Tool call returns timeout
- Default timeout is 30 seconds. For complex operations, increase timeout.
- For Open Anvil: set `ANVIL_TIMEOUT` environment variable.
- For Floyd-Lab: labs may need more time to spawn.

### Floyd-Lab spawn fails
- Check system resources (CPU, memory, disk).
- Ensure Docker/VM infrastructure is available if the lab implementation requires it.
- Check lab server logs on stderr.

### SuperCache returns empty
- Cache is conversation-scoped unless using persistent storage.
- Verify the cache key matches exactly.
- Check `cache_list` to see what's stored.

### Pipeline stuck
- Check `pipeline/state/pipeline-state.json` for current phase.
- Check `pipeline/receipts/` for any BLOCK reports.
- Resume from the blocked agent by feeding it the block report + its prompt.

### Open Anvil extension not connecting
- See the dedicated Open Anvil troubleshooting section in `OPEN-ANVIL-COMPLETE-GUIDE.md`.

---

## APPENDIX: COMPLETE TOOL COUNT

| Server | Tool Count |
|--------|-----------|
| Open Anvil | 45 |
| Floyd DevTools | 10 |
| Floyd Runner | 5 |
| Floyd Safe-Ops | 3 |
| Floyd SuperCache | 11 |
| Floyd Terminal | 10 |
| Floyd Patch | 5 |
| Floyd-Lab | 4 |
| Hivemind Orchestrator | 14 |
| Lab-Lead | 6 |
| Novel Concepts | 10 |
| Pattern Crystallizer | 7 |
| Omega-AGI | 8 |
| Context Singularity | 10 |
| **Total** | **~148 tools** |
