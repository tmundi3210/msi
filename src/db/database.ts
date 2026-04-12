import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import type {
  Node, NodeLink, Card, CardScheduling, Review, Session,
  NodeInput, CardInput, ReviewInput, SessionMode,
} from '../types';
import { v4 as uuid } from 'uuid';
import SCHEMA from './schema.sql?raw';

type Row = SqlValue[];

const DB_STORAGE_KEY = 'learning-os-db';

let db: SqlJsDatabase | null = null;

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: () => `${import.meta.env.BASE_URL}sql-wasm.wasm`,
  });

  // Try to restore from localStorage
  const saved = localStorage.getItem(DB_STORAGE_KEY);
  if (saved) {
    const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  persist();
  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  const b64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_STORAGE_KEY, b64);
}

function now(): string {
  return new Date().toISOString();
}

// --- Node operations ---

export function createNode(input: NodeInput): Node {
  const d = getDb();
  const node: Node = {
    id: uuid(),
    title: input.title,
    definition: input.definition,
    parentId: input.parentId ?? null,
    createdAt: now(),
    updatedAt: now(),
  };
  d.run(
    'INSERT INTO nodes (id, title, definition, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [node.id, node.title, node.definition, node.parentId, node.createdAt, node.updatedAt],
  );
  if (node.parentId) {
    createLink(node.parentId, node.id, 'parent');
  }
  persist();
  return node;
}

export function updateNode(id: string, input: Partial<NodeInput>): void {
  const d = getDb();
  const fields: string[] = [];
  const vals: (string | null)[] = [];
  if (input.title !== undefined) { fields.push('title = ?'); vals.push(input.title); }
  if (input.definition !== undefined) { fields.push('definition = ?'); vals.push(input.definition); }
  if (input.parentId !== undefined) { fields.push('parent_id = ?'); vals.push(input.parentId ?? null); }
  fields.push('updated_at = ?');
  vals.push(now());
  vals.push(id);
  d.run(`UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`, vals);
  persist();
}

export function deleteNode(id: string): void {
  const d = getDb();
  d.run('DELETE FROM nodes WHERE id = ?', [id]);
  persist();
}

export function getAllNodes(): Node[] {
  const d = getDb();
  const rows = d.exec('SELECT id, title, definition, parent_id, created_at, updated_at FROM nodes ORDER BY created_at DESC');
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    title: r[1] as string,
    definition: r[2] as string,
    parentId: r[3] as string | null,
    createdAt: r[4] as string,
    updatedAt: r[5] as string,
  }));
}

export function getNode(id: string): Node | null {
  const d = getDb();
  const rows = d.exec('SELECT id, title, definition, parent_id, created_at, updated_at FROM nodes WHERE id = ?', [id]);
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    id: r[0] as string,
    title: r[1] as string,
    definition: r[2] as string,
    parentId: r[3] as string | null,
    createdAt: r[4] as string,
    updatedAt: r[5] as string,
  };
}

// --- Link operations ---

export function createLink(sourceId: string, targetId: string, linkType: 'parent' | 'lateral'): NodeLink {
  const d = getDb();
  const link: NodeLink = { id: uuid(), sourceId, targetId, linkType, createdAt: now() };
  d.run(
    'INSERT OR IGNORE INTO node_links (id, source_id, target_id, link_type, created_at) VALUES (?, ?, ?, ?, ?)',
    [link.id, link.sourceId, link.targetId, link.linkType, link.createdAt],
  );
  persist();
  return link;
}

export function getLinksForNode(nodeId: string): NodeLink[] {
  const d = getDb();
  const rows = d.exec(
    'SELECT id, source_id, target_id, link_type, created_at FROM node_links WHERE source_id = ? OR target_id = ?',
    [nodeId, nodeId],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    sourceId: r[1] as string,
    targetId: r[2] as string,
    linkType: r[3] as 'parent' | 'lateral',
    createdAt: r[4] as string,
  }));
}

export function deleteLink(id: string): void {
  const d = getDb();
  d.run('DELETE FROM node_links WHERE id = ?', [id]);
  persist();
}

// --- Card operations ---

export function createCard(input: CardInput): Card {
  const d = getDb();
  const card: Card = {
    id: uuid(),
    nodeId: input.nodeId,
    cardType: input.cardType,
    front: input.front,
    back: input.back,
    createdAt: now(),
    updatedAt: now(),
  };
  d.run(
    'INSERT INTO cards (id, node_id, card_type, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [card.id, card.nodeId, card.cardType, card.front, card.back, card.createdAt, card.updatedAt],
  );
  // Initialize scheduling
  d.run(
    'INSERT INTO card_scheduling (card_id, ease_factor, interval_days, repetitions, next_review_at, status) VALUES (?, 2.5, 0, 0, ?, ?)',
    [card.id, now(), 'new'],
  );
  persist();
  return card;
}

export function updateCard(id: string, input: Partial<CardInput>): void {
  const d = getDb();
  const fields: string[] = [];
  const vals: (string | null)[] = [];
  if (input.front !== undefined) { fields.push('front = ?'); vals.push(input.front); }
  if (input.back !== undefined) { fields.push('back = ?'); vals.push(input.back); }
  if (input.cardType !== undefined) { fields.push('card_type = ?'); vals.push(input.cardType); }
  fields.push('updated_at = ?');
  vals.push(now());
  vals.push(id);
  d.run(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`, vals);
  persist();
}

export function deleteCard(id: string): void {
  const d = getDb();
  d.run('DELETE FROM cards WHERE id = ?', [id]);
  persist();
}

export function getCardsForNode(nodeId: string): Card[] {
  const d = getDb();
  const rows = d.exec(
    'SELECT id, node_id, card_type, front, back, created_at, updated_at FROM cards WHERE node_id = ? ORDER BY created_at',
    [nodeId],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    nodeId: r[1] as string,
    cardType: r[2] as 'qa' | 'cloze',
    front: r[3] as string,
    back: r[4] as string,
    createdAt: r[5] as string,
    updatedAt: r[6] as string,
  }));
}

export function getAllCards(): Card[] {
  const d = getDb();
  const rows = d.exec('SELECT id, node_id, card_type, front, back, created_at, updated_at FROM cards ORDER BY created_at');
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    nodeId: r[1] as string,
    cardType: r[2] as 'qa' | 'cloze',
    front: r[3] as string,
    back: r[4] as string,
    createdAt: r[5] as string,
    updatedAt: r[6] as string,
  }));
}

// --- Scheduling operations ---

export function getScheduling(cardId: string): CardScheduling | null {
  const d = getDb();
  const rows = d.exec(
    'SELECT card_id, ease_factor, interval_days, repetitions, next_review_at, status FROM card_scheduling WHERE card_id = ?',
    [cardId],
  );
  if (!rows.length || !rows[0].values.length) return null;
  const r = rows[0].values[0];
  return {
    cardId: r[0] as string,
    easeFactor: r[1] as number,
    intervalDays: r[2] as number,
    repetitions: r[3] as number,
    nextReviewAt: r[4] as string,
    status: r[5] as CardScheduling['status'],
  };
}

export function updateScheduling(s: CardScheduling): void {
  const d = getDb();
  d.run(
    'UPDATE card_scheduling SET ease_factor = ?, interval_days = ?, repetitions = ?, next_review_at = ?, status = ? WHERE card_id = ?',
    [s.easeFactor, s.intervalDays, s.repetitions, s.nextReviewAt, s.status, s.cardId],
  );
  persist();
}

export interface DueCard {
  card: Card;
  scheduling: CardScheduling;
  nodeName: string;
}

export function getDueCards(limit = 50): DueCard[] {
  const d = getDb();
  const rows = d.exec(
    `SELECT c.id, c.node_id, c.card_type, c.front, c.back, c.created_at, c.updated_at,
            s.card_id, s.ease_factor, s.interval_days, s.repetitions, s.next_review_at, s.status,
            n.title
     FROM cards c
     JOIN card_scheduling s ON c.id = s.card_id
     JOIN nodes n ON c.node_id = n.id
     WHERE s.next_review_at <= ?
     ORDER BY s.next_review_at ASC
     LIMIT ?`,
    [now(), limit],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    card: {
      id: r[0] as string,
      nodeId: r[1] as string,
      cardType: r[2] as 'qa' | 'cloze',
      front: r[3] as string,
      back: r[4] as string,
      createdAt: r[5] as string,
      updatedAt: r[6] as string,
    },
    scheduling: {
      cardId: r[7] as string,
      easeFactor: r[8] as number,
      intervalDays: r[9] as number,
      repetitions: r[10] as number,
      nextReviewAt: r[11] as string,
      status: r[12] as CardScheduling['status'],
    },
    nodeName: r[13] as string,
  }));
}

// --- Review operations ---

export function recordReview(input: ReviewInput): Review {
  const d = getDb();
  const review: Review = {
    id: uuid(),
    cardId: input.cardId,
    sessionId: input.sessionId,
    reviewedAt: now(),
    rating: input.rating,
    responseTimeMs: input.responseTimeMs,
  };
  d.run(
    'INSERT INTO reviews (id, card_id, session_id, reviewed_at, rating, response_time_ms) VALUES (?, ?, ?, ?, ?, ?)',
    [review.id, review.cardId, review.sessionId, review.reviewedAt, review.rating, review.responseTimeMs],
  );
  persist();
  return review;
}

export function getReviewsForCard(cardId: string): Review[] {
  const d = getDb();
  const rows = d.exec(
    'SELECT id, card_id, session_id, reviewed_at, rating, response_time_ms FROM reviews WHERE card_id = ? ORDER BY reviewed_at DESC',
    [cardId],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    cardId: r[1] as string,
    sessionId: r[2] as string | null,
    reviewedAt: r[3] as string,
    rating: r[4] as number,
    responseTimeMs: r[5] as number | null,
  }));
}

// --- Session operations ---

export function createSession(mode: SessionMode, preReflection?: string): Session {
  const d = getDb();
  const session: Session = {
    id: uuid(),
    startedAt: now(),
    endedAt: null,
    mode,
    cardsReviewed: 0,
    preReflection: preReflection ?? null,
    postReflection: null,
  };
  d.run(
    'INSERT INTO sessions (id, started_at, ended_at, mode, cards_reviewed, pre_reflection, post_reflection) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [session.id, session.startedAt, session.endedAt, session.mode, session.cardsReviewed, session.preReflection, session.postReflection],
  );
  persist();
  return session;
}

export function endSession(id: string, postReflection?: string): void {
  const d = getDb();
  // Count reviews in this session
  const countResult = d.exec('SELECT COUNT(*) FROM reviews WHERE session_id = ?', [id]);
  const count = countResult.length ? (countResult[0].values[0][0] as number) : 0;
  d.run(
    'UPDATE sessions SET ended_at = ?, cards_reviewed = ?, post_reflection = ? WHERE id = ?',
    [now(), count, postReflection ?? null, id],
  );
  persist();
}

export function getRecentSessions(limit = 10): Session[] {
  const d = getDb();
  const rows = d.exec(
    'SELECT id, started_at, ended_at, mode, cards_reviewed, pre_reflection, post_reflection FROM sessions ORDER BY started_at DESC LIMIT ?',
    [limit],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    id: r[0] as string,
    startedAt: r[1] as string,
    endedAt: r[2] as string | null,
    mode: r[3] as SessionMode,
    cardsReviewed: r[4] as number,
    preReflection: r[5] as string | null,
    postReflection: r[6] as string | null,
  }));
}

// --- Stats ---

export function getStats() {
  const d = getDb();
  const n = d.exec('SELECT COUNT(*) FROM nodes');
  const c = d.exec('SELECT COUNT(*) FROM cards');
  const due = d.exec('SELECT COUNT(*) FROM card_scheduling WHERE next_review_at <= ?', [now()]);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const reviewed = d.exec('SELECT COUNT(*) FROM reviews WHERE reviewed_at >= ?', [todayStart.toISOString()]);

  // Streak: count consecutive days with at least 1 review, going backwards from today
  let streak = 0;
  const dayCheck = new Date();
  dayCheck.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(dayCheck);
    const dayEnd = new Date(dayCheck);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayReviews = d.exec(
      'SELECT COUNT(*) FROM reviews WHERE reviewed_at >= ? AND reviewed_at < ?',
      [dayStart.toISOString(), dayEnd.toISOString()],
    );
    const count = dayReviews.length ? (dayReviews[0].values[0][0] as number) : 0;
    if (count > 0) {
      streak++;
      dayCheck.setDate(dayCheck.getDate() - 1);
    } else if (i === 0) {
      // Today has no reviews yet — check if yesterday did (streak still alive)
      dayCheck.setDate(dayCheck.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  return {
    totalNodes: n.length ? (n[0].values[0][0] as number) : 0,
    totalCards: c.length ? (c[0].values[0][0] as number) : 0,
    dueNow: due.length ? (due[0].values[0][0] as number) : 0,
    reviewedToday: reviewed.length ? (reviewed[0].values[0][0] as number) : 0,
    streak,
  };
}

export interface NodeWithStats {
  node: Node;
  cardCount: number;
  dueCount: number;
  avgEase: number | null;
}

export function getNodesWithStats(): NodeWithStats[] {
  const d = getDb();
  const rows = d.exec(
    `SELECT n.id, n.title, n.definition, n.parent_id, n.created_at, n.updated_at,
            COUNT(c.id) as card_count,
            SUM(CASE WHEN cs.next_review_at <= ? THEN 1 ELSE 0 END) as due_count,
            AVG(cs.ease_factor) as avg_ease
     FROM nodes n
     LEFT JOIN cards c ON c.node_id = n.id
     LEFT JOIN card_scheduling cs ON cs.card_id = c.id
     GROUP BY n.id
     ORDER BY due_count DESC, n.created_at DESC`,
    [now()],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    node: {
      id: r[0] as string,
      title: r[1] as string,
      definition: r[2] as string,
      parentId: r[3] as string | null,
      createdAt: r[4] as string,
      updatedAt: r[5] as string,
    },
    cardCount: (r[6] as number) || 0,
    dueCount: (r[7] as number) || 0,
    avgEase: r[8] as number | null,
  }));
}

export function getCardsWithScheduling(nodeId: string): Array<{ card: Card; scheduling: CardScheduling | null }> {
  const d = getDb();
  const rows = d.exec(
    `SELECT c.id, c.node_id, c.card_type, c.front, c.back, c.created_at, c.updated_at,
            cs.card_id, cs.ease_factor, cs.interval_days, cs.repetitions, cs.next_review_at, cs.status
     FROM cards c
     LEFT JOIN card_scheduling cs ON cs.card_id = c.id
     WHERE c.node_id = ?
     ORDER BY c.created_at`,
    [nodeId],
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: Row) => ({
    card: {
      id: r[0] as string,
      nodeId: r[1] as string,
      cardType: r[2] as 'qa' | 'cloze',
      front: r[3] as string,
      back: r[4] as string,
      createdAt: r[5] as string,
      updatedAt: r[6] as string,
    },
    scheduling: r[7] ? {
      cardId: r[7] as string,
      easeFactor: r[8] as number,
      intervalDays: r[9] as number,
      repetitions: r[10] as number,
      nextReviewAt: r[11] as string,
      status: r[12] as CardScheduling['status'],
    } : null,
  }));
}

export function getReviewHistory(days = 14): Array<{ date: string; count: number }> {
  const d = getDb();
  const result: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const rows = d.exec(
      'SELECT COUNT(*) FROM reviews WHERE reviewed_at >= ? AND reviewed_at < ?',
      [day.toISOString(), nextDay.toISOString()],
    );
    result.push({
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: rows.length ? (rows[0].values[0][0] as number) : 0,
    });
  }
  return result;
}

// --- Bulk card creation ---

export function createCardsBulk(nodeId: string, cards: Array<{ cardType: 'qa' | 'cloze'; front: string; back: string }>): Card[] {
  const d = getDb();
  const created: Card[] = [];
  const timestamp = now();
  for (const input of cards) {
    const id = uuid();
    const card: Card = {
      id,
      nodeId,
      cardType: input.cardType,
      front: input.front,
      back: input.back,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    d.run(
      'INSERT INTO cards (id, node_id, card_type, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [card.id, card.nodeId, card.cardType, card.front, card.back, card.createdAt, card.updatedAt],
    );
    d.run(
      'INSERT INTO card_scheduling (card_id, ease_factor, interval_days, repetitions, next_review_at, status) VALUES (?, 2.5, 0, 0, ?, ?)',
      [card.id, timestamp, 'new'],
    );
    created.push(card);
  }
  persist();
  return created;
}

// --- Export / Import ---

export function exportData(): string {
  const d = getDb();
  const schedulingRows = d.exec('SELECT card_id, ease_factor, interval_days, repetitions, next_review_at, status FROM card_scheduling');
  const scheduling = schedulingRows.length ? schedulingRows[0].values.map((r: Row) => ({
    cardId: r[0], easeFactor: r[1], intervalDays: r[2], repetitions: r[3], nextReviewAt: r[4], status: r[5],
  })) : [];
  const reviewRows = d.exec('SELECT id, card_id, session_id, reviewed_at, rating, response_time_ms FROM reviews ORDER BY reviewed_at');
  const reviews = reviewRows.length ? reviewRows[0].values.map((r: Row) => ({
    id: r[0], cardId: r[1], sessionId: r[2], reviewedAt: r[3], rating: r[4], responseTimeMs: r[5],
  })) : [];
  const linkRows = d.exec('SELECT id, source_id, target_id, link_type, created_at FROM node_links');
  const links = linkRows.length ? linkRows[0].values.map((r: Row) => ({
    id: r[0], sourceId: r[1], targetId: r[2], linkType: r[3], createdAt: r[4],
  })) : [];

  return JSON.stringify({
    version: 1,
    exportedAt: now(),
    nodes: getAllNodes(),
    cards: getAllCards(),
    scheduling,
    reviews,
    links,
    sessions: getRecentSessions(10000),
  }, null, 2);
}

export function importData(json: string): { nodes: number; cards: number } {
  const data = JSON.parse(json);
  const d = getDb();

  let nodeCount = 0;
  let cardCount = 0;

  // Import nodes
  if (data.nodes) {
    for (const n of data.nodes) {
      const existing = d.exec('SELECT id FROM nodes WHERE id = ?', [n.id]);
      if (!existing.length || !existing[0].values.length) {
        d.run('INSERT INTO nodes (id, title, definition, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [n.id, n.title, n.definition, n.parentId ?? null, n.createdAt, n.updatedAt]);
        nodeCount++;
      }
    }
  }

  // Import cards
  if (data.cards) {
    for (const c of data.cards) {
      const existing = d.exec('SELECT id FROM cards WHERE id = ?', [c.id]);
      if (!existing.length || !existing[0].values.length) {
        d.run('INSERT INTO cards (id, node_id, card_type, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [c.id, c.nodeId, c.cardType, c.front, c.back, c.createdAt, c.updatedAt]);
        cardCount++;
      }
    }
  }

  // Import scheduling
  if (data.scheduling) {
    for (const s of data.scheduling) {
      const existing = d.exec('SELECT card_id FROM card_scheduling WHERE card_id = ?', [s.cardId]);
      if (!existing.length || !existing[0].values.length) {
        d.run('INSERT INTO card_scheduling (card_id, ease_factor, interval_days, repetitions, next_review_at, status) VALUES (?, ?, ?, ?, ?, ?)',
          [s.cardId, s.easeFactor, s.intervalDays, s.repetitions, s.nextReviewAt, s.status]);
      }
    }
  }

  // Import links
  if (data.links) {
    for (const l of data.links) {
      d.run('INSERT OR IGNORE INTO node_links (id, source_id, target_id, link_type, created_at) VALUES (?, ?, ?, ?, ?)',
        [l.id, l.sourceId, l.targetId, l.linkType, l.createdAt]);
    }
  }

  persist();
  return { nodes: nodeCount, cards: cardCount };
}
