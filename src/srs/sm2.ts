import type { CardScheduling } from '../types';

/**
 * Standard SM-2 algorithm implementation.
 *
 * Rating scale (0-5):
 *   0 - Complete blackout
 *   1 - Incorrect; correct answer remembered upon seeing it
 *   2 - Incorrect; correct answer seemed easy to recall after seeing it
 *   3 - Correct with serious difficulty
 *   4 - Correct after hesitation
 *   5 - Perfect response
 *
 * Ratings 0-2 = "fail" (card resets to learning).
 * Ratings 3-5 = "pass" (card advances).
 */

export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  status: CardScheduling['status'];
}

export function sm2(current: CardScheduling, rating: number): SM2Result {
  const clampedRating = Math.max(0, Math.min(5, Math.round(rating)));

  // New ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEF = current.easeFactor + (0.1 - (5 - clampedRating) * (0.08 + (5 - clampedRating) * 0.02));
  // Ease factor floor is 1.3
  newEF = Math.max(1.3, newEF);

  let newInterval: number;
  let newReps: number;
  let newStatus: CardScheduling['status'];

  if (clampedRating < 3) {
    // Failed: reset to learning
    newReps = 0;
    newInterval = 0; // Review again soon (within minutes in a real app, but we use < 1 day)
    newStatus = current.status === 'new' ? 'learning' : 'relearning';

    // Learning steps: review in 1 minute, then 10 minutes, then 1 day
    // For simplicity in Phase 1a, we set next review to ~10 minutes from now
    const nextReview = new Date(Date.now() + 10 * 60 * 1000);
    return {
      easeFactor: newEF,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: nextReview.toISOString(),
      status: newStatus,
    };
  }

  // Passed
  newReps = current.repetitions + 1;
  newStatus = 'review';

  if (newReps === 1) {
    newInterval = 1; // 1 day
  } else if (newReps === 2) {
    newInterval = 6; // 6 days
  } else {
    newInterval = Math.round(current.intervalDays * newEF);
  }

  // Cap interval at 365 days
  newInterval = Math.min(365, newInterval);

  const nextReview = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);

  return {
    easeFactor: newEF,
    intervalDays: newInterval,
    repetitions: newReps,
    nextReviewAt: nextReview.toISOString(),
    status: newStatus,
  };
}

/**
 * Human-readable description of the next review time.
 */
export function formatInterval(intervalDays: number): string {
  if (intervalDays < 1) return 'Soon';
  if (intervalDays === 1) return '1 day';
  if (intervalDays < 30) return `${Math.round(intervalDays)} days`;
  if (intervalDays < 365) return `${Math.round(intervalDays / 30)} months`;
  return `${(intervalDays / 365).toFixed(1)} years`;
}

/**
 * Rating labels for UI buttons.
 */
export const RATING_LABELS: Record<number, string> = {
  0: 'Blackout',
  1: 'Wrong',
  2: 'Barely wrong',
  3: 'Hard',
  4: 'Good',
  5: 'Easy',
};
