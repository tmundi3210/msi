import { useState, useEffect, useCallback, useRef } from 'react';
import { useReview } from '../hooks/useReview';
import { useDatabase } from '../hooks/useDatabase';
import { createSession, endSession, getDueCards } from '../db/database';
import { RATING_LABELS, formatInterval, sm2 } from '../srs/sm2';
import type { SessionMode } from '../types';

export default function ReviewPage() {
  const { currentCard, remaining, total, answer, reload } = useReview();
  const { refresh } = useDatabase();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>('full');
  const [showAnswer, setShowAnswer] = useState(false);
  const [preReflection, setPreReflection] = useState('');
  const [postReflection, setPostReflection] = useState('');
  const [phase, setPhase] = useState<'pre' | 'review' | 'post'>('pre');
  const [reviewed, setReviewed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalResponseTime, setTotalResponseTime] = useState(0);
  const cardStartTime = useRef<number>(Date.now());

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'review' || !currentCard) return;
      // Don't capture when typing in textarea/input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (!showAnswer && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShowAnswer(true);
      } else if (showAnswer && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        handleRating(parseInt(e.key) - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const startSession = useCallback((mode: SessionMode) => {
    const session = createSession(mode, preReflection || undefined);
    setSessionId(session.id);
    setSessionMode(mode);
    setPhase('review');
    setReviewed(0);
    setCorrectCount(0);
    setTotalResponseTime(0);
    cardStartTime.current = Date.now();
    reload();
  }, [preReflection, reload]);

  const handleRating = useCallback((rating: number) => {
    const elapsed = Date.now() - cardStartTime.current;
    answer(rating, elapsed, sessionId);
    setShowAnswer(false);
    setReviewed(r => r + 1);
    if (rating >= 3) setCorrectCount(c => c + 1);
    setTotalResponseTime(t => t + elapsed);
    cardStartTime.current = Date.now();

    // Minimum viable session: stop after 10 cards
    if (sessionMode === 'minimum' && reviewed + 1 >= 10) {
      setTimeout(() => setPhase('post'), 100);
    }
  }, [answer, sessionId, sessionMode, reviewed]);

  const finishSession = useCallback(() => {
    if (sessionId) {
      endSession(sessionId, postReflection || undefined);
      refresh();
    }
    setPhase('pre');
    setSessionId(null);
    setShowAnswer(false);
    setPreReflection('');
    setPostReflection('');
  }, [sessionId, postReflection, refresh]);

  // Pre-session
  if (phase === 'pre') {
    const dueCount = getDueCards(200).length;
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Review Session</h1>

        {dueCount === 0 ? (
          <div className="empty-state">
            <h2>Nothing to review</h2>
            <p>All caught up! Add more cards or wait for existing ones to become due.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>What do you expect to struggle with today?</p>
              <textarea
                value={preReflection}
                onChange={e => setPreReflection(e.target.value)}
                placeholder="Optional — helps prime retrieval..."
                rows={2}
              />
            </div>

            <p style={{ marginBottom: 20, color: 'var(--text-muted)' }}>
              {dueCount} card{dueCount !== 1 ? 's' : ''} due for review.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ padding: '14px 28px' }} onClick={() => startSession('full')}>
                Full Session
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  All {dueCount} due cards
                </span>
              </button>
              <button className="btn-ghost" style={{ padding: '14px 28px' }} onClick={() => startSession('minimum')}>
                Quick Session
                <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  Top 10 most urgent
                </span>
              </button>
            </div>

            <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <strong>Keyboard:</strong> Space/Enter = show answer, 1-6 = rate card (1=Blackout ... 6=Easy)
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  // Post-session
  if (phase === 'post') {
    const accuracy = reviewed > 0 ? Math.round((correctCount / reviewed) * 100) : 0;
    const avgTime = reviewed > 0 ? Math.round(totalResponseTime / reviewed / 1000) : 0;
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Session Complete</h1>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Cards Reviewed</div>
            <div className="stat-value">{reviewed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Accuracy</div>
            <div className="stat-value" style={{ color: accuracy >= 80 ? 'var(--recall-cold)' : accuracy >= 60 ? 'var(--recall-warm)' : 'var(--recall-hot)' }}>
              {accuracy}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg. Response</div>
            <div className="stat-value">{avgTime}s</div>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>What surprised you?</p>
          <textarea
            value={postReflection}
            onChange={e => setPostReflection(e.target.value)}
            placeholder="Optional — tracks metacognitive accuracy over time..."
            rows={2}
          />
        </div>
        <button className="btn-primary" onClick={finishSession}>
          Finish
        </button>
      </div>
    );
  }

  // Queue complete
  if (!currentCard) {
    const accuracy = reviewed > 0 ? Math.round((correctCount / reviewed) * 100) : 0;
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Queue Complete</h1>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: '100%' }} />
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--recall-cold)', marginBottom: 8 }}>{reviewed}</div>
          <div style={{ color: 'var(--text-muted)' }}>cards reviewed — {accuracy}% correct</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary" onClick={() => setPhase('post')}>
            End Session
          </button>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const isCloze = currentCard.card.cardType === 'cloze';

  const renderFront = (text: string) => {
    if (!isCloze) return text;
    return text.replace(/\{\{(.+?)\}\}/g, '______');
  };

  return (
    <div className="review-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Review</h1>
          {sessionMode === 'minimum' && (
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>Quick Session</span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
          {total - remaining + 1} / {sessionMode === 'minimum' ? Math.min(total, 10) : total}
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {currentCard.nodeName}
        </span>
        <span className={`badge ${currentCard.scheduling.status === 'new' ? 'badge-new' : currentCard.scheduling.status === 'review' ? 'badge-good' : 'badge-due'}`}>
          {currentCard.scheduling.status}
        </span>
      </div>

      <div className="review-front">
        {renderFront(currentCard.card.front)}
      </div>

      {!showAnswer ? (
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary" style={{ padding: '14px 48px', fontSize: 16 }} onClick={() => setShowAnswer(true)}>
            Show Answer
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>or press Space</p>
        </div>
      ) : (
        <>
          <div className="review-back">
            {currentCard.card.back}
          </div>
          <div className="review-actions">
            {[0, 1, 2, 3, 4, 5].map(r => {
              const result = sm2(currentCard.scheduling, r);
              return (
                <button
                  key={r}
                  className={`rating-${r}`}
                  onClick={() => handleRating(r)}
                  title={`Next review: ${formatInterval(result.intervalDays)}`}
                >
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{r + 1}</div>
                  <div>{RATING_LABELS[r]}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                    {formatInterval(result.intervalDays)}
                  </div>
                </button>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Press 1-6 to rate
          </p>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button className="btn-ghost" onClick={() => setPhase('post')}>
          End Session Early
        </button>
      </div>
    </div>
  );
}
