import { useMemo } from 'react';
import { useQueueSocket } from '../hooks/useQueueSocket';
import { useLiveElapsed } from '../hooks/useLiveElapsed';
import { formatWait, formatClockTime } from '../utils/formatWait';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PatientView() {
  const { queue, connected, reconnecting, error } = useQueueSocket();

  const hasCurrent = queue?.currentToken != null;
  const liveElapsed = useLiveElapsed(
    queue?.currentCalledAt,
    queue?.elapsedInCurrentMinutes,
    hasCurrent
  );

  const upNext = useMemo(() => queue?.waiting?.slice(0, 5) ?? [], [queue?.waiting]);
  const remainingCount = Math.max(0, (queue?.waitingCount ?? 0) - upNext.length);

  return (
    <main className="waiting-room">
      <header className="waiting-header">
        <div>
          <p className="clinic-name">Neighbourhood Clinic</p>
          <h1>Waiting room</h1>
        </div>
        <span className={`pill ${connected ? 'live' : reconnecting ? 'reconnecting' : 'offline'}`}>
          {connected ? '● Live updates' : reconnecting ? '○ Reconnecting…' : '○ Offline'}
        </span>
      </header>

      {error && <div className="banner error">{error}</div>}

      <section className="hero-card">
        <p className="hero-label">Now being seen</p>
        {hasCurrent ? (
          <>
            <div className="hero-token" key={queue.currentToken}>
              {queue.currentToken}
            </div>
            <p className="hero-sub">Please proceed to the consultation room</p>
            <p className="hero-elapsed">
              Consultation in progress: {formatWait(liveElapsed)}
            </p>
          </>
        ) : (
          <>
            <div className="hero-token muted">-</div>
            <p className="hero-sub">Waiting for the next patient to be called</p>
          </>
        )}
      </section>

      <section className="stats-row">
        <div className="stat">
          <span className="stat-value">{queue?.waitingCount ?? 0}</span>
          <span className="stat-label">In queue</span>
        </div>
        <div className="stat">
          <span className="stat-value">{queue?.settings?.effectiveAvgMinutes ?? '-'}</span>
          <span className="stat-label">Avg min / visit</span>
        </div>
        <div className="stat">
          <span className="stat-value">{queue?.completedToday ?? 0}</span>
          <span className="stat-label">Seen today</span>
        </div>
      </section>

      <section className="card waiting-card">
        <h2>Up next</h2>
        {upNext.length === 0 ? (
          <p className="empty">No one waiting. You may be called soon.</p>
        ) : (
          <>
            <ul className="up-next-list">
              {upNext.map((p, i) => (
                <li key={p.id} className={i === 0 ? 'next-up' : ''}>
                  <span className="up-token">#{p.tokenNumber}</span>
                  <span className="up-position">
                    {i === 0 && !hasCurrent ? 'Next' : i === 0 ? 'Next' : `${p.patientsAhead} ahead`}
                  </span>
                  <span className="up-wait-col">
                    <span className="up-wait">{formatWait(p.estimatedWaitMinutes)} wait</span>
                    {p.estimatedCallAt && (
                      <span className="up-call-time">~{formatClockTime(p.estimatedCallAt)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <p className="more-waiting">+{remainingCount} more in queue</p>
            )}
          </>
        )}
      </section>

      <footer className="waiting-footer">
        <p>
          Wait times use{' '}
          <strong>
            {queue?.settings?.avgSource === 'rolling_average'
              ? `average of last ${queue.settings.rollingSampleSize} consultations`
              : 'clinic average set by reception'}
          </strong>{' '}
          × your position in the queue. Updates on its own.
        </p>
        {queue?.serverTime && (
          <small>Last sync {formatTime(queue.serverTime)}</small>
        )}
      </footer>
    </main>
  );
}
