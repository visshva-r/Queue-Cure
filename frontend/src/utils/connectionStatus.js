export function connectionPillClass({ connected, reconnecting, connecting, syncing, waking }) {
  if (connected) return 'live';
  if (waking || reconnecting || syncing) return 'reconnecting';
  if (connecting) return 'connecting';
  return 'offline';
}

export function connectionPillLabel({ connected, reconnecting, connecting, syncing, waking }, liveLabel) {
  if (connected) return liveLabel;
  if (waking) return '○ Waking server…';
  if (reconnecting) return '○ Reconnecting…';
  if (syncing) return '○ Syncing live updates…';
  if (connecting) return '○ Connecting…';
  return '○ Offline';
}
