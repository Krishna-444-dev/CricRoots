'use client';

import React, { useEffect, useState } from 'react';
import { useMatchWebSocket } from '@/hooks/useMatchWebSocket';
import styles from './AITacticalAdvisor.module.css';

interface AITacticalAdvisorProps {
  matchId: string;
  userId: string;
  token: string;
  isLive: boolean;
}

export const AITacticalAdvisor: React.FC<AITacticalAdvisorProps> = ({
  matchId,
  userId,
  token,
  isLive
}) => {
  const { isConnected, error, aiInsights: liveInsights, connectedUsers } = useMatchWebSocket({
    matchId,
    userId,
    token,
    enabled: isLive
  });

  // The socket only pushes a fresh insight after the *next* ball is recorded, so opening this
  // tab mid-match with nobody scoring right now left it spinning forever. Fetch the current
  // snapshot once on mount via the REST endpoint; the socket then keeps it fresh as balls land.
  const [initialInsights, setInitialInsights] = useState<typeof liveInsights>(null);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    fetch(`/api/matches/${matchId}/ai-insights`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setInitialInsights(data.aiInsights);
      })
      .catch(() => {
        if (!cancelled) setInitialLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [matchId, isLive]);

  const aiInsights = liveInsights || initialInsights;

  if (!isLive) {
    return null;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!aiInsights) {
    if (initialLoadFailed) {
      return (
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>Could not load AI insights. Try again shortly.</p>
        </div>
      );
    }
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading AI insights...</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dominant':
        return '#4CAF50';
      case 'Balanced':
        return '#FF9800';
      case 'Challenging':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'Dominant':
        return '💪';
      case 'Balanced':
        return '⚖️';
      case 'Challenging':
        return '⚠️';
      default:
        return '📊';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span>{getStatusEmoji(aiInsights.match_status)}</span>
            AI Tactical Advisor
          </h2>
          <div className={styles.connectionBadge}>
            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></span>
            <span className={styles.connectionText}>
              {isConnected ? '🔴 Live' : 'Reconnecting...'}
            </span>
            {connectedUsers > 0 && (
              <span className={styles.usersCount}>
                👥 {connectedUsers} watching
              </span>
            )}
          </div>
        </div>

        {/* Win Probability Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Win Probability</h3>
          <div className={styles.probabilityContainer}>
            <div className={styles.progressBarWrapper}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${aiInsights.win_probability * 100}%`,
                  backgroundColor: getStatusColor(aiInsights.match_status),
                }}
              ></div>
            </div>
            <p className={styles.probabilityText} style={{ color: getStatusColor(aiInsights.match_status) }}>
              {(aiInsights.win_probability * 100).toFixed(1)}%
            </p>
          </div>
          <p className={styles.statusBadge}>
            Status: <span style={{ color: getStatusColor(aiInsights.match_status), fontWeight: 'bold' }}>
              {aiInsights.match_status}
            </span>
          </p>
        </div>

        {/* Tactical Advice Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Strategic Advice</h3>
          <div className={styles.adviceBox}>
            <p className={styles.adviceText}>{aiInsights.tactical_advice}</p>
          </div>
        </div>

        {/* "Key Recommendations" (next batsman/bowler) intentionally omitted here - the
        underlying model is trained purely on match-state features (run rate, wickets,
        overs, pitch) with no roster input at all, so its output is an arbitrary synthetic
        class label with no correspondence to any real player in this or any match. Showing
        it as "Player #149" looked like a broken name lookup; it isn't fixable with a name
        lookup because there's nothing real for the number to refer to. Win probability and
        tactical advice above are genuinely grounded in this match's real state and stay. */}

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.footerText}>🔴 Real-time updates via WebSocket</p>
        </div>
      </div>
    </div>
  );
};

export default AITacticalAdvisor;
