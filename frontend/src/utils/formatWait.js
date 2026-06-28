export function formatWait(mins) {
  if (mins == null || Number.isNaN(mins)) return '-';
  if (mins < 1) return '< 1 min';
  return `~${mins} min`;
}

export function formatClockTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
