import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Empty string uses page origin when frontend is proxied locally; production sets VITE_API_URL
const SOCKET_URL = import.meta.env.VITE_API_URL || '';

let sharedSocket = null;
let socketRefCount = 0;

function getSharedSocket() {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  socketRefCount += 1;
  return sharedSocket;
}

function releaseSharedSocket() {
  socketRefCount -= 1;
  if (socketRefCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    socketRefCount = 0;
  }
}

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
    const socket = getSharedSocket();

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setError(null);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onReconnectAttempt = () => {
      setReconnecting(true);
    };

    const onReconnect = () => {
      setReconnecting(false);
      refresh();
    };

    const onQueueSync = (snapshot) => {
      setQueue(snapshot);
      setError(null);
    };

    const onQueueUpdate = (snapshot) => {
      setQueue(snapshot);
      setError(null);
    };

    const onQueueError = (payload) => {
      setError(payload.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);
    socket.on('queue:sync', onQueueSync);
    socket.on('queue:update', onQueueUpdate);
    socket.on('queue:error', onQueueError);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect', onReconnect);
      socket.off('queue:sync', onQueueSync);
      socket.off('queue:update', onQueueUpdate);
      socket.off('queue:error', onQueueError);
      releaseSharedSocket();
    };
  }, [refresh]);

  return { queue, connected, reconnecting, error, refresh };
}
