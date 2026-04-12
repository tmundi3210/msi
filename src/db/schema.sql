-- Learning OS Phase 1a Schema
-- Content and structure are separate from performance data.

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK(link_type IN ('parent', 'lateral')),
  created_at TEXT NOT NULL,
  UNIQUE(source_id, target_id)
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK(card_type IN ('qa', 'cloze')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_scheduling (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'learning', 'review', 'relearning'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  reviewed_at TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 0 AND rating <= 5),
  response_time_ms INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('full', 'minimum', 'cluster')),
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  pre_reflection TEXT,
  post_reflection TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cards_node_id ON cards(node_id);
CREATE INDEX IF NOT EXISTS idx_card_scheduling_next_review ON card_scheduling(next_review_at);
CREATE INDEX IF NOT EXISTS idx_card_scheduling_status ON card_scheduling(status);
CREATE INDEX IF NOT EXISTS idx_reviews_card_id ON reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_node_links_source ON node_links(source_id);
CREATE INDEX IF NOT EXISTS idx_node_links_target ON node_links(target_id);
