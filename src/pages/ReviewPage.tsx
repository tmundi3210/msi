import { useState, useRef, useCallback } from 'react';
import { useReview } from '../hooks/useReview';
import { useDatabase } from '../hooks/useDatabase';
import { createSession, endSession } from '../db/database';
import { RATING_LABELS, formatInterval } from '../srs/sm2';
import { sm2 } from '../srs/sm2';

export default function ReviewPage() {
  const { currentCard, remaining, total, answer, reload } = useReview();
  const { refresh } = useDatabase();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [preReflection, setPreReflection] = useState('');
  const [postReflection, setPostReflection] = useState('');
  const [phase, setPhase] = useState<'pre' | 'review' | 'post'>('pre');
  const [reviewed, setReviewed] = useState(0);
  const cardStartTime = useRef<number>(Date.now());

  const startSession = useCallback(() => {
    const session = createSession('full', preReflection || undefined);
    setSessionId(session.id);
    setPhase('review');
    setReviewed(0);
    cardStartTime.current = Date.now();
    reload();
  }, [preReflection, reload]);

  const handleRating = useCallback((rating: number) => {
    const elapsed = Date.now() - cardStartTime.current;
    answer(rating, elapsed, sessionId);
    setShowAnswer(false);
    setReviewed(r => r + 1);
    cardStartTime.current = Date.now();
  }, [answer, sessionId]);

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

  // Pre-session: intention setting
  if (phase === 'pre') {
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Review Session</h1>

        {total === 0 ? (
          <div className="empty-state">
            <h2>Nothing to review</h2>
            <p>All caught up! Add more cards or wait for existing ones to become due.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Pre-Session Check</p>
              <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 14 }}>
                What do you expect to struggle with today?
              </p>
              <textarea
                value={preReflection}
                onChange={e => setPreReflection(e.target.value)}
                placeholder="Optional — helps prime retrieval..."
                rows={2}
              />
            </div>
            <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
              {total} card{total !== 1 ? 's' : ''} due for review.
            </p>
            <button className="btn-primary" onClick={startSession}>
              Start Review
            </button>
          </>
        )}
      </div>
    );
  }

  // Post-session: reflection
  if (phase === 'post') {
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Session Complete</h1>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Cards Reviewed</div>
            <div className="stat-value">{reviewed}</div>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Post-Session Reflection</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 14 }}>
            What surprised you?
          </p>
          <textarea
            value={postReflection}
            onChange={e => setPostReflection(e.target.value)}
            placeholder="Optional..."
            rows={2}
          />
        </div>
        <button className="btn-primary" onClick={finishSession}>
          Finish
        </button>
      </div>
    );
  }

  // No more cards
  if (!currentCard) {
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 24 }}>Review</h1>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: '100%' }} />
        </div>
        <div className="empty-state">
          <h2>Queue complete</h2>
          <p>You reviewed {reviewed} card{reviewed !== 1 ? 's' : ''} this session.</p>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn-primary" onClick={() => setPhase('post')}>
            End Session
          </button>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const isCloze = currentCard.card.cardType === 'cloze';

  // Render cloze front: replace {{...}} with blanks
  const renderFront = (text: string) => {
    if (!isCloze) return text;
    return text.replace(/\{\{(.+?)\}\}/g, '______');
  };

  return (
    <div className="review-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Review</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {total - remaining + 1} / {total}
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {currentCard.nodeName}
      </div>

      <div className="review-front">
        {renderFront(currentCard.card.front)}
      </div>

      {!showAnswer ? (
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary" style={{ padding: '14px 48px', fontSize: 16 }} onClick={() => setShowAnswer(true)}>
            Show Answer
          </button>
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
                  <div>{RATING_LABELS[r]}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                    {formatInterval(result.intervalDays)}
                  </div>
                </button>
              );
            })}
          </div>
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
