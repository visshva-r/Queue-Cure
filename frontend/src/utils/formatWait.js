export function formatWait(mins) {
  if (mins == null || Number.isNaN(mins)) return '-';
  if (mins < 1) return '< 1 min';
  return `~${mins} min`;
}
