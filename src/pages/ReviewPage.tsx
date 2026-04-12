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
  const [elapsed, setElapsed] = useState(0);
  const cardStartTime = useRef<number>(Date.now());
  const sessionStartTime = useRef<number>(Date.now());

  // Live timer
  useEffect(() => {
    if (phase !== 'review') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - cardStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, currentCard?.card.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== 'review' || !currentCard) return;
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
    sessionStartTime.current = Date.now();
    reload();
  }, [preReflection, reload]);

  const handleRating = useCallback((rating: number) => {
    const responseTime = Date.now() - cardStartTime.current;
    answer(rating, responseTime, sessionId);
    setShowAnswer(false);
    setReviewed(r => r + 1);
    if (rating >= 3) setCorrectCount(c => c + 1);
    setTotalResponseTime(t => t + responseTime);
    cardStartTime.current = Date.now();
    setElapsed(0);

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

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  // Pre-session
  if (phase === 'pre') {
    const dueCount = getDueCards(500).length;
    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 8 }}>Review</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
          {dueCount > 0
            ? `${dueCount} card${dueCount !== 1 ? 's' : ''} waiting for review.`
            : 'All caught up. Come back later.'}
        </p>

        {dueCount === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12, color: 'var(--success)' }}>
              All Clear
            </div>
            <p style={{ color: 'var(--text-muted)' }}>Nothing due right now. Add more cards or wait for scheduled reviews.</p>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="section-title">Pre-Session</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 13 }}>
                What do you expect to struggle with today?
              </p>
              <textarea
                value={preReflection}
                onChange={e => setPreReflection(e.target.value)}
                placeholder="Optional — primes retrieval..."
                rows={2}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary btn-lg" style={{ flex: 1 }} onClick={() => startSession('full')}>
                <div>
                  <div>Full Session</div>
                  <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>All {dueCount} cards</div>
                </div>
              </button>
              <button className="btn-ghost btn-lg" style={{ flex: 1 }} onClick={() => startSession('minimum')}>
                <div>
                  <div>Quick Session</div>
                  <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>Top 10 urgent</div>
                </div>
              </button>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="kbd">Space</span> Show answer
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="kbd">1</span>-<span className="kbd">6</span> Rate
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Post-session
  if (phase === 'post') {
    const accuracy = reviewed > 0 ? Math.round((correctCount / reviewed) * 100) : 0;
    const avgTime = reviewed > 0 ? (totalResponseTime / reviewed / 1000).toFixed(1) : '0';
    const sessionDuration = Math.round((Date.now() - sessionStartTime.current) / 60000);

    return (
      <div className="review-card">
        <h1 style={{ marginBottom: 8 }}>Session Complete</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          {sessionDuration > 0 ? `${sessionDuration} minute${sessionDuration !== 1 ? 's' : ''}` : 'Less than a minute'}
        </p>

        <div className="stats-row">
          <div className="stat-card" data-color="accent">
            <div className="stat-label">Reviewed</div>
            <div className="stat-value">{reviewed}</div>
          </div>
          <div className="stat-card" data-color={accuracy >= 80 ? 'success' : accuracy >= 50 ? 'warning' : 'danger'}>
            <div className="stat-label">Accuracy</div>
            <div className="stat-value">{accuracy}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Speed</div>
            <div className="stat-value">{avgTime}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>s</span></div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Post-Session</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 13 }}>What surprised you?</p>
          <textarea
            value={postReflection}
            onChange={e => setPostReflection(e.target.value)}
            placeholder="Optional — builds metacognitive awareness..."
            rows={2}
          />
        </div>

        <button className="btn-primary btn-lg" style={{ width: '100%' }} onClick={finishSession}>
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
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: '100%' }} />
        </div>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--success))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{reviewed}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
            cards reviewed — {accuracy}% correct
          </p>
          <button className="btn-primary btn-lg" onClick={() => setPhase('post')}>
            End Session
          </button>
        </div>
      </div>
    );
  }

  // Active review
  const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const isCloze = currentCard.card.cardType === 'cloze';
  const sessionLimit = sessionMode === 'minimum' ? Math.min(total, 10) : total;

  const renderFront = (text: string) => {
    if (!isCloze) return text;
    return text.replace(/\{\{(.+?)\}\}/g, '______');
  };

  return (
    <div className="review-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 0 }}>Review</h1>
          {sessionMode === 'minimum' && (
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>QUICK SESSION</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="timer">{formatTimer(elapsed)}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {total - remaining + 1} / {sessionLimit}
          </span>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          {currentCard.nodeName}
        </span>
        <span className={`badge ${
          currentCard.scheduling.status === 'new' ? 'badge-new' :
          currentCard.scheduling.status === 'review' ? 'badge-good' : 'badge-warn'
        }`}>
          {currentCard.scheduling.status}
        </span>
      </div>

      {/* Front */}
      <div className="review-front">
        {renderFront(currentCard.card.front)}
      </div>

      {/* Answer / actions */}
      {!showAnswer ? (
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary btn-lg" style={{ padding: '16px 64px' }} onClick={() => setShowAnswer(true)}>
            Show Answer
          </button>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <span className="kbd">Space</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
            <span className="kbd">Enter</span>
          </div>
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
                >
                  <span className="kbd" style={{ fontSize: 10, marginBottom: 2, minWidth: 18, height: 18 }}>{r + 1}</span>
                  <div style={{ fontSize: 12 }}>{RATING_LABELS[r]}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>
                    {formatInterval(result.intervalDays)}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <button className="btn-ghost btn-sm" onClick={() => setPhase('post')}>
          End Session Early
        </button>
      </div>
    </div>
  );
}
