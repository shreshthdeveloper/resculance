import { api } from './client';

export async function listPatients(params = {}) {
  const res = await api.get('/patients', { params });
  return res.data.data;
}

export async function listAvailablePatients(params = {}) {
  const res = await api.get('/patients/available', { params });
  return res.data.data;
}

// The backend has no `GET /patients/:id`. Workaround: query the list with a
// generous limit and find by id client-side. Acceptable because /patients
// is org-scoped (returns 50–200 records typical) and this is a paramedic
// app, not an admin tool with millions of records.
export async function getPatient(id) {
  const r = await listPatients({ limit: 500, includeInactive: true });
  const found = r.patients.find((p) => String(p.id) === String(id));
  if (!found) {
    const err = new Error('Patient not found');
    err.status = 404;
    throw err;
  }
  return found;
}

export async function createPatient(input) {
  const res = await api.post('/patients', input);
  return res.data.data;
}

export async function onboardPatient(patientId, input) {
  const res = await api.post(`/patients/${patientId}/onboard`, input);
  return res.data.data;
}
