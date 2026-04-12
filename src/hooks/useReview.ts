import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import { getDueCards, getScheduling, updateScheduling, recordReview, type DueCard } from '../db/database';
import { sm2 } from '../srs/sm2';
import type { ReviewInput } from '../types';

export function useReview() {
  const { ready, version, refresh } = useDatabase();
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (ready) {
      const due = getDueCards(100);
      setQueue(due);
      setCurrentIndex(0);
    }
  }, [ready, version]);

  const currentCard = queue[currentIndex] ?? null;
  const remaining = queue.length - currentIndex;
  const total = queue.length;

  const answer = useCallback((rating: number, responseTimeMs: number | null, sessionId: string | null) => {
    if (!currentCard) return;

    const scheduling = getScheduling(currentCard.card.id);
    if (!scheduling) return;

    // Run SM-2
    const result = sm2(scheduling, rating);
    updateScheduling({
      cardId: currentCard.card.id,
      ...result,
    });

    // Record the review
    const input: ReviewInput = {
      cardId: currentCard.card.id,
      sessionId,
      rating,
      responseTimeMs,
    };
    recordReview(input);

    // Advance to next card
    setCurrentIndex(i => i + 1);
    refresh();
  }, [currentCard, refresh]);

  const reload = useCallback(() => {
    const due = getDueCards(100);
    setQueue(due);
    setCurrentIndex(0);
  }, []);

  return { currentCard, remaining, total, answer, reload };
}
