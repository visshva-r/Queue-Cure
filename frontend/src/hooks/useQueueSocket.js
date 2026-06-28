import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Empty string uses page origin when frontend is proxied locally; production sets VITE_API_URL
const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function useQueueSocket() {
  const [queue, setQueue] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/queue`);
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();
      setQueue(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.io.on('reconnect_attempt', () => {
      setReconnecting(true);
    });

    socket.on('reconnect', () => {
      setReconnecting(false);
      refresh();
    });

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
  }, [refresh]);

  return { queue, connected, reconnecting, error, refresh };
};
