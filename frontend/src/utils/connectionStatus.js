export function connectionPillClass({ connected, reconnecting, connecting, syncing }) {
  if (connected) return 'live';
  if (reconnecting || syncing) return 'reconnecting';
  if (connecting) return 'connecting';
  return 'offline';
}

export function connectionPillLabel({ connected, reconnecting, connecting, syncing }, liveLabel) {
  if (connected) return liveLabel;
  if (reconnecting) return '○ Reconnecting…';
  if (syncing) return '○ Syncing live updates…';
  if (connecting) return '○ Connecting…';
  return '○ Offline';
}
