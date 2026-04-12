// --- Core domain types ---

export interface Node {
  id: string;
  title: string;
  definition: string;
  parentId: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface NodeLink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: 'parent' | 'lateral';
  createdAt: string;
}

export type CardType = 'qa' | 'cloze';

export interface Card {
  id: string;
  nodeId: string;
  cardType: CardType;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
}

export type CardStatus = 'new' | 'learning' | 'review' | 'relearning';

export interface CardScheduling {
  cardId: string;
  easeFactor: number;    // SM-2: starts at 2.5
  intervalDays: number;  // days until next review
  repetitions: number;   // consecutive correct reviews
  nextReviewAt: string;  // ISO 8601
  status: CardStatus;
}

export interface Review {
  id: string;
  cardId: string;
  sessionId: string | null;
  reviewedAt: string;
  rating: number;        // 0-5 (SM-2 scale)
  responseTimeMs: number | null;
}

export type SessionMode = 'full' | 'minimum' | 'cluster';

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  mode: SessionMode;
  cardsReviewed: number;
  preReflection: string | null;
  postReflection: string | null;
}

// --- Form/input types ---

export interface NodeInput {
  title: string;
  definition: string;
  parentId?: string | null;
}

export interface CardInput {
  nodeId: string;
  cardType: CardType;
  front: string;
  back: string;
}

export interface ReviewInput {
  cardId: string;
  sessionId: string | null;
  rating: number;
  responseTimeMs: number | null;
}
