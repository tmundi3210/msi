import { useState, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { getAllNodes, getCardsWithScheduling } from '../db/database';
import { formatInterval } from '../srs/sm2';
import type { CardType } from '../types';

export default function CardsPage() {
  const { version } = useDatabase();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | CardType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'learning' | 'review' | 'due'>('all');
  const [filterNode, setFilterNode] = useState('');

  const nodes = useMemo(() => getAllNodes(), [version]);

  const allCards = useMemo(() => {
    const result: Array<{
      card: { id: string; nodeId: string; cardType: CardType; front: string; back: string };
      scheduling: { status: string; intervalDays: number; nextReviewAt: string; easeFactor: number; repetitions: number } | null;
      nodeName: string;
    }> = [];
    for (const node of nodes) {
      const cards = getCardsWithScheduling(node.id);
      for (const c of cards) {
        result.push({ ...c, nodeName: node.title });
      }
    }
    return result;
  }, [nodes, version]);

  const filtered = useMemo(() => {
    let cards = allCards;

    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(c =>
        c.card.front.toLowerCase().includes(q) ||
        c.card.back.toLowerCase().includes(q) ||
        c.nodeName.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') {
      cards = cards.filter(c => c.card.cardType === filterType);
    }

    if (filterNode) {
      cards = cards.filter(c => c.card.nodeId === filterNode);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'due') {
        const now = new Date().toISOString();
        cards = cards.filter(c => c.scheduling && c.scheduling.nextReviewAt <= now);
      } else {
        cards = cards.filter(c => c.scheduling?.status === filterStatus);
      }
    }

    return cards;
  }, [allCards, search, filterType, filterStatus, filterNode]);

  const statusCounts = useMemo(() => {
    const now = new Date().toISOString();
    return {
      all: allCards.length,
      new: allCards.filter(c => c.scheduling?.status === 'new').length,
      learning: allCards.filter(c => c.scheduling?.status === 'learning').length,
      review: allCards.filter(c => c.scheduling?.status === 'review').length,
      due: allCards.filter(c => c.scheduling && c.scheduling.nextReviewAt <= now).length,
    };
  }, [allCards]);

  return (
    <div>
      <div className="page-header">
        <h1>Card Browser</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {filtered.length} of {allCards.length} cards
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cards..."
          style={{ maxWidth: 300 }}
        />
        <select value={filterNode} onChange={e => setFilterNode(e.target.value)} style={{ width: 180 }}>
          <option value="">All Nodes</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as 'all' | CardType)} style={{ width: 120 }}>
          <option value="all">All Types</option>
          <option value="qa">Q&A</option>
          <option value="cloze">Cloze</option>
        </select>
      </div>

      {/* Status tabs */}
      <div className="tabs" style={{ maxWidth: 500 }}>
        {(['all', 'due', 'new', 'learning', 'review'] as const).map(s => (
          <button
            key={s}
            className={`tab ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span style={{ marginLeft: 4, opacity: 0.6 }}>{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Card list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No cards found</h2>
          <p>{search ? `No cards match "${search}"` : 'Create cards from the Nodes page.'}</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Front</th>
              <th>Back</th>
              <th>Node</th>
              <th>Type</th>
              <th>Status</th>
              <th>Interval</th>
              <th>Ease</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ card, scheduling, nodeName }) => {
              const isDue = scheduling && new Date(scheduling.nextReviewAt) <= new Date();
              const statusBadge = isDue ? 'badge-due'
                : scheduling?.status === 'new' ? 'badge-new'
                : scheduling?.status === 'review' ? 'badge-good'
                : 'badge-warn';
              const statusText = isDue ? 'Due' : (scheduling?.status ?? 'new');

              return (
                <tr key={card.id}>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.front}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {card.back}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{nodeName}</td>
                  <td><span className={`badge ${card.cardType === 'cloze' ? 'badge-new' : 'badge-good'}`}>{card.cardType}</span></td>
                  <td><span className={`badge ${statusBadge}`}>{statusText}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {scheduling ? formatInterval(scheduling.intervalDays) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {scheduling ? scheduling.easeFactor.toFixed(1) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
