import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function useQueueSocket() {
  const [queue, setQueue] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('queue:sync', (snapshot) => {
      setQueue(snapshot);
      setError(null);
    });

    socket.on('queue:update', (snapshot) => {
      setQueue(snapshot);
      setError(null);
    });

    socket.on('queue:error', (payload) => {
      setError(payload.message);
    });

    return () => socket.disconnect();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();
      setQueue(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  return { queue, connected, error, refresh };
}
