# Floyd Labs — Skills Catalog

> **Source**: https://floydslabs.com/tools
> **Retrieved**: 2026-03-16
> **Total Skills**: 73+
> **MCP Protocol**: 2024-11
> **Latency**: < 500ms | **Uptime**: 99.9%

---

## Connection

### MCP Endpoint
```
POST https://floydslabs.com/api/mcp
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

### Claude Desktop Config
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

---

## Skills Reference

### Reasoning (4 skills)

| Skill | URI | Description |
|-------|-----|-------------|
| **Analogy Synthesis** | `floyd-skills://analogy-synthesis` | Generate meaningful analogies to explain complex concepts |
| **Consensus Algorithms** | `floyd-skills://consensus-algorithms` | Reasoning.consensus.decision-making |
| **Meta Reasoning** | `floyd-skills://meta-reasoning` | Reason about reasoning processes to optimize thinking strategies and avoid pitfalls |
| **MIT Analysis** | `floyd-skills://mit-analysis` | Multiple Instance Theory analysis for understanding complex problem spaces with multiple valid interpretations |

---

### Analysis (5 skills)

| Skill | URI | Description |
|-------|-----|-------------|
| **Performance Profiling Patterns** | `floyd-skills://performance-profiling-patterns` | analysis.performance.optimization |
| **Semantic Diff Validation** | `floyd-skills://semantic-diff-validation` | analysis.code-validation.semantic |
| **Statistical Performance Benchmarking** | `floyd-skills://statistical-performance-benchmarking` | analysis.algorithms.performance |
| **Tarjan Circular Dependency Detection** | `floyd-skills://tarjan-circular-dependency-detection` | analysis.algorithms.graph-theory |
| **Cognitive Load Analysis** | `floyd-skills://cognitive-load-analysis` | Analyze cognitive load of tasks, interfaces, and information to optimize for human understanding |

---

### Patterns (3 skills)

| Skill | URI | Description |
|-------|-----|-------------|
| **API Contract Validation** | `floyd-skills://api-contract-validation` | patterns.validation.api-compatibility |
| **Test Generation Patterns** | `floyd-skills://test-generation-patterns` | patterns.testing.automated-generation |
| **Pattern Extraction** | `floyd-skills://pattern-extraction` | Extract code patterns, idioms, and architectural patterns from codebases for reuse and standardization |

---

### Workflows (1 skill)

| Skill | URI | Description |
|-------|-----|-------------|
| **Code Review Workflow** | `floyd-skills://code-review-workflow` | workflows.code-review.quality-assurance |

---

### General (52 skills)

#### Agent Orchestration & Coordination

| Skill | URI | Description |
|-------|-----|-------------|
| **Adaptive Behavior** | `floyd-skills://adaptive-behavior` | Enable agents to adapt behavior based on environment, feedback, and learning |
| **Adaptive Strategy** | `floyd-skills://adaptive-strategy` | Develop strategies that adapt to changing conditions with trigger-based pivots |
| **Agent Communication** | `floyd-skills://agent-communication` | Facilitate structured communication between agents with message routing and protocol handling |
| **Collective Decision Making** | `floyd-skills://collective-decision-making` | Facilitate collective decision making across multiple agents with voting and preference aggregation |
| **Collective Learning** | `floyd-skills://collective-learning` | Coordinate learning across multiple agents with knowledge aggregation and transfer |
| **Consensus Protocol** | `floyd-skills://consensus-protocol` | Implement consensus protocols for multi-agent decision making with conflict resolution |
| **Conflict Resolution** | `floyd-skills://conflict-resolution` | Detect and resolve conflicts between agents, resources, and objectives |
| **Distributed Task Management** | `floyd-skills://distributed-task-management` | Manage and coordinate tasks across distributed agents with load balancing and fault tolerance |
| **Emergent Intelligence** | `floyd-skills://emergent-intelligence` | Detect and nurture emergent intelligent behaviors from agent interactions |
| **Goal Alignment** | `floyd-skills://goal-alignment` | Ensure alignment between agent goals, user goals, and system objectives |
| **Resource Allocation** | `floyd-skills://resource-allocation` | Optimize resource allocation across agents and tasks with constraint satisfaction |
| **Role Assignment** | `floyd-skills://role-assignment` | Dynamically assign and manage roles for agents based on capabilities and requirements |
| **Self Organization** | `floyd-skills://self-organization` | Enable agent systems to self-organize based on goals, constraints, and environment |
| **Swarm Intelligence** | `floyd-skills://swarm-intelligence` | Coordinate swarm-based problem solving with emergent behavior and collective optimization |
| **Synchronization** | `floyd-skills://synchronization` | Synchronize state, clocks, and actions across distributed agents |
| **Value Alignment** | `floyd-skills://value-alignment` | Ensure agent behavior aligns with specified values and ethical principles |

#### Context Management

| Skill | URI | Description |
|-------|-----|-------------|
| **Attention Allocation** | `floyd-skills://attention-allocation` | Optimize attention allocation across multiple tasks, contexts, and priorities |
| **Context Compression** | `floyd-skills://context-compression` | Compress context while preserving semantic meaning using abstractive and extractive techniques |
| **Context Dependency Analysis** | `floyd-skills://context-dependency-analysis` | Analyze dependencies between context elements to understand information flow and requirements |
| **Context Orchestration** | `floyd-skills://context-orchestration` | Orchestrate multiple context sources, prioritize information, and manage context flow across agents |
| **Context Packing** | `floyd-skills://context-packing` | Efficiently pack maximum relevant context into limited token windows using intelligent compression |
| **Context Persistence** | `floyd-skills://context-persistence` | Manage persistent storage and retrieval of context across sessions and agents |
| **Context Scalability Analysis** | `floyd-skills://context-scalability-analysis` | Analyze how context handling scales with increasing complexity and volume |

#### Knowledge & Concepts

| Skill | URI | Description |
|-------|-----|-------------|
| **Concept Crystallization** | `floyd-skills://concept-crystallization` | Transform vague concepts into precise, actionable definitions with clear boundaries and relationships |
| **Concept Web Analysis** | `floyd-skills://concept-web-analysis` | Analyze interconnected concepts as a web/graph to understand relationships and dependencies |
| **Knowledge Graph Building** | `floyd-skills://knowledge-graph-building` | Build and evolve knowledge graphs from unstructured data with entity extraction and relationship inference |
| **Knowledge Sharing** | `floyd-skills://knowledge-sharing` | Facilitate knowledge sharing between agents with versioning and conflict detection |
| **Knowledge Synthesis** | `floyd-skills://knowledge-synthesis` | Synthesize knowledge from multiple sources into coherent, structured understanding |
| **Semantic Understanding** | `floyd-skills://semantic-understanding` | Deep semantic analysis of text to extract meaning, intent, entities, and relationships |

#### Patterns & Matching

| Skill | URI | Description |
|-------|-----|-------------|
| **Pattern Matching** | `floyd-skills://pattern-matching` | Identify patterns across diverse data sources using multiple matching algorithms and confidence scoring |
| **Pattern Synthesis** | `floyd-skills://pattern-synthesis` | Synthesize new patterns from existing patterns through combination, abstraction, and generalization |

#### Development Tools

| Skill | URI | Description |
|-------|-----|-------------|
| **API Format Verifier** | `floyd-skills://api-format-verifier` | Verify API specifications against OpenAPI/Swagger/RAML standards with compliance scoring and format conversion |
| **Benchmark Runner** | `floyd-skills://benchmark-runner` | Execute code benchmarks with statistical analysis, regression detection, and performance recommendations |
| **Build Error Correlator** | `floyd-skills://build-error-correlator` | Correlate build errors across multiple builds to identify patterns, recurring issues, and suggest automated fixes |
| **Failure To Test Transmuter** | `floyd-skills://failure-to-test-transmuter` | Automatically generate test cases from production failures, stack traces, and error reports |
| **Git Bisect** | `floyd-skills://git-bisect` | Automated git bisect with test command execution to identify the exact commit that introduced a bug |
| **Monorepo Dependency Analyzer** | `floyd-skills://monorepo-dependency-analyzer` | Analyze dependencies across monorepo packages, detect circular dependencies, and visualize the dependency graph |
| **Schema Migrator** | `floyd-skills://schema-migrator` | Generate database schema migrations with validation, rollback plans, and SQL generation for safe schema evolution |
| **Secure Hook Executor** | `floyd-skills://secure-hook-executor` | Execute Git hooks in a sandboxed environment with security analysis and blocked operation detection |
| **Trace Replay Debugger** | `floyd-skills://trace-replay-debugger` | Record and replay execution traces for time-travel debugging and root cause analysis |
| **TypeScript Semantic Analyzer** | `floyd-skills://typescript-semantic-analyzer` | Perform deep semantic analysis of TypeScript code including symbol extraction, type inference, and reference tracking |

#### Visualization & Planning

| Skill | URI | Description |
|-------|-----|-------------|
| **Dependency Hologram** | `floyd-skills://dependency-hologram` | Generate interactive 2D/3D dependency visualizations for complex project architectures |
| **Long Term Visioning** | `floyd-skills://long-term-visioning` | Develop and maintain long-term visions with scenario planning and trend analysis |
| **Strategic Planning** | `floyd-skills://strategic-planning` | Develop and execute strategic plans with goal decomposition and progress tracking |

#### Meta-Cognition

| Skill | URI | Description |
|-------|-----|-------------|
| **Meta Cognitive Strategy** | `floyd-skills://meta-cognitive-strategy` | Develop and apply meta-cognitive strategies for improved reasoning and self-awareness |
| **Self Reflection** | `floyd-skills://self-reflection` | Enable agents to reflect on their own performance, decisions, and learning |

#### Ethics & Quality

| Skill | URI | Description |
|-------|-----|-------------|
| **Ethical Reasoning** | `floyd-skills://ethical-reasoning` | Apply ethical frameworks to decision making with stakeholder impact analysis |
| **Quality Scoring** | `floyd-skills://quality-scoring` | 140-point quality scoring algorithm for comprehensive evaluation of code, documentation, and artifacts |

#### Infrastructure

| Skill | URI | Description |
|-------|-----|-------------|
| **Lab Inventory** | `floyd-skills://lab-inventory` | Track and manage Floyd Lab tools, skills, and resources with versioning and usage analytics |
| **Tool Discovery** | `floyd-skills://tool-discovery` | Discover and recommend relevant tools based on project context, task requirements, and usage patterns |

---

## API Usage Examples

### List All Skills
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "floyd",
    "arguments": {
      "action": "list"
    }
  }
}
```

### Describe a Skill
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "floyd",
    "arguments": {
      "action": "describe",
      "skill": "git-bisect"
    }
  }
}
```

### Execute a Skill
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "floyd",
    "arguments": {
      "action": "execute",
      "skill": "concept-crystallization",
      "args": {
        "action": "crystallize",
        "concept": "microservices architecture"
      }
    }
  }
}
```

---

## Category Summary

```
┌────────────────────────┬─────────┐
│ Category               │ Skills  │
├────────────────────────┼─────────┤
│ General                │ 52      │
│ Reasoning              │ 4       │
│ Analysis               │ 5       │
│ Patterns               │ 3       │
│ Workflows              │ 1       │
├────────────────────────┼─────────┤
│ Total                  │ 65+     │
└────────────────────────┴─────────┘
```

---

## Notes

- All skills rate 9.5/10 quality score
- Protocol version: MCP 2024-11
- Single proxy tool schema (context-efficient: 1 tool vs 73+)
- Zero subscriptions — $0/month
- 13 MCP servers running 24/7
- 99.8% uptime SLA

---

*Retrieved from Floyd Labs by FLOYD v5.0.2 on 2026-03-16*
