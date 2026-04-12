# Personal Learning OS — Full Integrated Plan

---

## Core Philosophy

Most learning tools fail for the same reason: they optimize for input, not retrieval. Highlighting, importing, generating flashcards — all of this feels productive but addresses the wrong bottleneck. The bottleneck in learning is never getting information in. It is forcing your brain to produce it under pressure, repeatedly, at the right intervals.

**Everything in this system serves one constraint: make retrieval practice smarter, more frequent, and better targeted.**

The system is not a note-taking tool with flashcard export. It is a retrieval engine with an intake pipeline attached.

---

## The Central Object: The Knowledge Node

Every feature in the system is scaffolding around a single data structure.

A Knowledge Node contains:
- **Concept** — the "what," expressed as a title and a brief definition
- **Flashcards** — multiple retrieval handles into this concept (different angles, difficulty levels, card types)
- **Recall score** — updated by actual performance data, not self-rating
- **Decay rate** — how fast the node fades without review; varies by domain complexity and your personal forgetting curve for that material
- **Structural links** — parent nodes, child nodes, and lateral connections to related concepts
- **Source provenance** — which import, session, or teach-back produced this node

The three main views of the system are all the same data rendered differently:

- **Mind Map** = node graph rendered spatially, colored by recall health
- **Review Queue** = nodes sorted by urgency (decay rate x time since last review)
- **Schedule** = node urgency mapped against available time blocks

These are not separate features. They are three windows onto one data model. Changes in one propagate immediately to the others.

---

## Data Architecture

### Design Decisions (from critique)

- **Separate content from performance**: `Node` holds concept + structure. `NodePerformance` holds recall, decay, history. This enables curriculum sharing without leaking personal metrics.
- **Recall score aggregation**: Node-level recall = weighted average of card scores, with worst-performing card weighted 2x. This drives mind map coloring.
- **Decay rate defaults**: Domain-level defaults until 20+ reviews exist for a node, then per-node estimation.

### Core Entities
- **User** — profile, time preferences, domain blocks, performance history, prediction accuracy log
- **Node** — concept, links, source references, version history
- **NodePerformance** — recall score, decay rate, review history (separate from Node)
- **Card** — type, content, difficulty, interval data, hesitation log, source node, flag status
- **CardScheduling** — SM-2 state: ease factor, interval, repetitions, next review date
- **Session** — timestamp, mode, cards reviewed, performance data, pre/post reflections
- **Review** — individual card review record with timing data

### Storage
- Default: local storage with SQLite (sql.js WASM for browser)
- Optional cloud sync for cross-device access (future, requires CRDT strategy)
- Export/backup as JSON (critical for local-first trust)

---

## Build Phases

### Phase 1a — Pure SRS with Structure (CURRENT)
- Node CRUD + linking
- Standard card types (Q&A, cloze)
- Standard SM-2 scheduling (no hesitation modification yet)
- Review queue (list view, urgency-sorted)
- Session mode with basic stats
- Export/backup

### Phase 1b — Visual Layer
- Mind map rendering (canvas-based, not SVG — must handle 500+ nodes)
- Decay coloring on nodes
- Hesitation tracking integration into SM-2 as confidence modifier
- Depth expansion and cluster selection
- Minimum viable session mode

### Phase 2 — AI Intake
- Document and text import pipeline
- AI candidate generation with confirmation UI
- "This is wrong" flagging with feedback loop
- Audio transcription (designed with Phase 3 teach-back in mind)
- Cloud LLM by default; local as future optimization

### Phase 3 — Teach-Back with Gap Detection
- Speak-to-answer card mode
- Real-time transcription with hesitation detection
- Post-session gap analysis and node/card suggestions
- Session transcript review with gap highlighting

### Phase 4 — Scheduling Integration
- Full calendar interface with domain blocks
- Drag-and-drop topic scheduling
- Auto-distribution with revision buffers
- Time-of-day calibration (requires 30+ days of data, with explicit "not enough data" messaging)

### Phase 5 — Advanced Features
- Cross-concept card generation
- Interleaving with configurable escape hatch (not forced)
- New-card release valve: minimum 10% session time for new cards regardless of urgency backlog
- Pre/post session reflection tracking
- Learning from scratch workflow (with draft node state for scaffolded nodes)
- Contradiction detection and resolution

---

## SRS Design Notes

- SM-2 base algorithm, unmodified for Phase 1a
- Hesitation (Phase 1b): adjusts confidence interval on difficulty estimate, NOT a direct penalty
- Interleaving: default on, but configurable per-domain (blocked practice valid for certain domains)
- New card allocation: configurable minimum per session to prevent permanent backlog
- Rating: 0-5 scale (SM-2 standard). Response time logged for future use.

---

## Success Criteria

The system is working when:
- Users complete review sessions before opening any other part of the app
- The minimum viable session mode is used more than full sessions on weekdays
- Decay visualization creates pull toward review without push notifications
- Users can look at the review queue and immediately know where their knowledge is weakest

The system is failing when:
- Users spend more time organizing than reviewing
- AI-generated cards are accepted without editing
- New material is added faster than old material is consolidated
- The app feels productive but retention does not improve
