import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

// Empty string uses page origin when frontend is proxied locally; production sets VITE_API_URL
const SOCKET_URL = import.meta.env.VITE_API_URL || '';
const API_TIMEOUT_MS = 45000;
const WAKE_RETRY_MS = 5000;

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
  if (socketRefCount < 0) socketRefCount = 0;
}

function teardownSharedSocket() {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  socketRefCount = 0;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', teardownSharedSocket);
}

async function fetchQueueSnapshot() {
  const base = import.meta.env.VITE_API_URL || '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/queue`, { signal: controller.signal });
    if (!res.ok) throw new Error('Failed to fetch queue');
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('API returned an unexpected response');
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function useQueueSocket() {
  const [queue, setQueue] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [ready, setReady] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState(null);
  const wakeRetryRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchQueueSnapshot();
      setQueue(data);
      setError(null);
      setReady(true);
      setWaking(false);
      if (wakeRetryRef.current) {
        clearTimeout(wakeRetryRef.current);
        wakeRetryRef.current = null;
      }
    } catch (err) {
      if (!ready) {
        setWaking(true);
        setError(null);
        if (!wakeRetryRef.current) {
          wakeRetryRef.current = setTimeout(() => {
            wakeRetryRef.current = null;
            refresh();
          }, WAKE_RETRY_MS);
        }
      } else {
        setError(err.message || 'Failed to fetch queue');
      }
    }
  }, [ready]);

  useEffect(() => {
    return () => {
      if (wakeRetryRef.current) clearTimeout(wakeRetryRef.current);
    };
  }, []);

  useEffect(() => {
    refresh();

    const socket = getSharedSocket();

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setError(null);
      refresh();
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
      setReady(true);
      setWaking(false);
    };

    const onQueueUpdate = (snapshot) => {
      setQueue(snapshot);
      setError(null);
      setReady(true);
      setWaking(false);
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

  const connecting = !ready && !connected && !reconnecting && !waking;
  const syncing = ready && !connected && !reconnecting;

  return { queue, connected, reconnecting, connecting, syncing, waking, ready, error, refresh };
}
