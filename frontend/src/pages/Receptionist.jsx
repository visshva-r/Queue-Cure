import { useState, useRef, useEffect } from 'react';
import { useQueueSocket } from '../hooks/useQueueSocket';
import { api } from '../api';

export default function Receptionist() {
  const { queue, connected, error } = useQueueSocket();
  const [name, setName] = useState('');
  const [avgInput, setAvgInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastToken, setLastToken] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (queue?.settings?.avgConsultationMinutes != null) {
      setAvgInput(String(queue.settings.avgConsultationMinutes));
    }
  }, [queue?.settings?.avgConsultationMinutes]);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  async function runAction(action, successMsg) {
    setBusy(true);
    try {
      const result = await action();
      if (successMsg) showToast(successMsg);
      return result;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
      nameRef.current?.focus();
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await runAction(() => api.addPatient(name.trim()));
    if (result) {
      setLastToken(result.tokenNumber);
      setName('');
    }
  }

  async function handleCallNext() {
    await runAction(() => api.callNext(), 'Patient called');
  }

  async function handleComplete() {
    const result = await runAction(() => api.complete(), 'Consultation completed');
    if (result?.consultationDurationMinutes) {
      showToast(`Recorded ${result.consultationDurationMinutes} min. Average will update.`);
    }
  }

  async function handleNoShow() {
    await runAction(() => api.noShow(), 'Marked as no-show');
  }

  async function handleRemove(id) {
    await runAction(() => api.removePatient(id), 'Removed from queue');
  }

  async function handleAvgSave(e) {
    e.preventDefault();
    await runAction(
      () => api.setAvgMinutes(Number(avgInput)),
      'Average consultation time updated'
    );
  }

  async function handleReset() {
    if (!window.confirm('Reset queue for a new day? This clears all waiting patients.')) return;
    await runAction(() => api.resetDay(), 'Queue reset for new day');
  }

  const hasCurrent = queue?.currentToken != null;
  const nextWaiting = queue?.waiting?.[0];

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (!busy && !hasCurrent && nextWaiting) handleCallNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, hasCurrent, nextWaiting]);

  return (
    <main className="reception">
      <div className="status-row">
        <span className={`pill ${connected ? 'live' : 'offline'}`}>
          {connected ? '● Live' : '○ Offline'}
        </span>
        {queue?.settings && (
          <span className="meta">
            Avg consult: <strong>{queue.settings.effectiveAvgMinutes} min</strong>
            <em>
              ({queue.settings.avgSource === 'rolling_average' ? 'from last visits' : 'receptionist set'})
            </em>
          </span>
        )}
        {queue && <span className="meta">Completed today: {queue.completedToday}</span>}
      </div>

      {error && <div className="banner error">{error}</div>}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <section className="grid-2">
        <div className="card highlight">
          <h2>Add patient</h2>
          <p className="hint">Enter name and press Enter to assign a token</p>
          <form onSubmit={handleAdd} className="add-form">
            <input
              ref={nameRef}
              type="text"
              placeholder="Patient name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoComplete="off"
              maxLength={80}
            />
            <button type="submit" disabled={busy || !name.trim()} className="btn primary">
              Issue token
            </button>
          </form>
          {lastToken != null && (
            <p className="last-token">
              Last issued: <span className="token-badge">#{lastToken}</span>
            </p>
          )}
        </div>

        <div className="card">
          <h2>Consultation time</h2>
          <p className="hint">Fallback until enough completed visits build a rolling average</p>
          <form onSubmit={handleAvgSave} className="avg-form">
            <input
              type="number"
              min={1}
              max={120}
              value={avgInput}
              onChange={(e) => setAvgInput(e.target.value)}
              disabled={busy}
            />
            <span>min</span>
            <button type="submit" disabled={busy} className="btn secondary">
              Save
            </button>
          </form>
        </div>
      </section>

      <section className="card now-serving">
        <div className="now-label">Now serving</div>
        {hasCurrent ? (
          <div className="now-token">#{queue.currentToken}</div>
        ) : (
          <div className="now-empty">-</div>
        )}
        {hasCurrent && <p className="now-name">{queue.currentPatientName}</p>}
        <div className="action-row">
          <button
            className="btn call-next"
            onClick={handleCallNext}
            disabled={busy || hasCurrent || !nextWaiting}
            title={hasCurrent ? 'Complete current first' : !nextWaiting ? 'No one waiting' : 'Call next (N)'}
          >
            Call next
            {nextWaiting && <small>#{nextWaiting.tokenNumber}</small>}
          </button>
          <button className="btn success" onClick={handleComplete} disabled={busy || !hasCurrent}>
            Done
          </button>
          <button className="btn ghost" onClick={handleNoShow} disabled={busy || !hasCurrent}>
            No-show
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Waiting ({queue?.waitingCount ?? 0})</h2>
          <button className="btn ghost small" onClick={handleReset} disabled={busy}>
            Reset day
          </button>
        </div>
        {!queue?.waiting?.length ? (
          <p className="empty">No patients waiting</p>
        ) : (
          <ul className="queue-list">
            {queue.waiting.map((p) => (
              <li key={p.id}>
                <span className="token-badge">#{p.tokenNumber}</span>
                <span className="patient-name">{p.name}</span>
                <span className="wait-est">~{p.estimatedWaitMinutes} min</span>
                <button
                  className="btn icon"
                  onClick={() => handleRemove(p.id)}
                  disabled={busy}
                  title="Remove from queue"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
