import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import { getCardsForNode, createCard, updateCard, deleteCard } from '../db/database';
import type { Card, CardInput } from '../types';

export function useCards(nodeId: string | null) {
  const { ready, version, refresh } = useDatabase();
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    if (ready && nodeId) setCards(getCardsForNode(nodeId));
  }, [ready, version, nodeId]);

  const add = useCallback((input: CardInput): Card => {
    const card = createCard(input);
    refresh();
    return card;
  }, [refresh]);

  const edit = useCallback((id: string, input: Partial<CardInput>) => {
    updateCard(id, input);
    refresh();
  }, [refresh]);

  const remove = useCallback((id: string) => {
    deleteCard(id);
    refresh();
  }, [refresh]);

  return { cards, add, edit, remove };
}
