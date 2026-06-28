import { useState, useEffect } from 'react';

function minutesBetween(start, end) {
  return Math.round(((end - start) / 60000) * 10) / 10;
}

export function useLiveElapsed(calledAt, baseElapsed, active) {
  const [elapsed, setElapsed] = useState(baseElapsed ?? 0);

  useEffect(() => {
    if (!active || !calledAt) {
      setElapsed(0);
      return;
    }

    const start = new Date(calledAt);
    const tick = () => setElapsed(minutesBetween(start, new Date()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [calledAt, active, baseElapsed]);

  return elapsed;
}
