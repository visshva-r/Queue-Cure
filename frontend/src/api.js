const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  addPatient: (name) => request('/patients', { method: 'POST', body: JSON.stringify({ name }) }),
  callNext: () => request('/queue/call-next', { method: 'POST' }),
  complete: () => request('/queue/complete', { method: 'POST' }),
  noShow: () => request('/queue/no-show', { method: 'POST' }),
  removePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),
  restorePatient: (id) => request(`/patients/${id}/restore`, { method: 'POST' }),
  setAvgMinutes: (avgConsultationMinutes) =>
    request('/settings/avg-consultation', {
      method: 'PATCH',
      body: JSON.stringify({ avgConsultationMinutes }),
    }),
  resetDay: () => request('/queue/reset-day', { method: 'POST' }),
};
