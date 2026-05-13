// Patient + patient-history endpoints. The backend exposes most patient ops
// under /patients/* — onboarding-related routes also live there (the actual
// session is created by POST /patients/:patientId/onboard).

import { api } from './client';

export async function listPatients(params = {}) {
  const res = await api.get('/patients', { params });
  return res.data.data;
}

export async function listAvailablePatients(params = {}) {
  const res = await api.get('/patients/available', { params });
  return res.data.data;
}

// Lookup by the patient_code field (the human-readable identifier). Cheap
// and useful when the user scans / types a code rather than picking from
// the list.
export async function getPatientByCode(code) {
  const res = await api.get(`/patients/code/${encodeURIComponent(code)}`);
  return res.data.data?.patient ?? res.data.data;
}

// The backend has no `GET /patients/:id` route. Workaround: query the list
// with a generous limit and find by id client-side. Acceptable because
// /patients is org-scoped (returns 50–200 records typical) and this is a
// paramedic app, not an admin tool with millions of records.
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

export async function updatePatient(id, input) {
  const res = await api.put(`/patients/${id}`, input);
  return res.data.data;
}

export async function onboardPatient(patientId, input) {
  const res = await api.post(`/patients/${patientId}/onboard`, input);
  return res.data.data;
}

// GET /patients/:patientId/sessions — full history for one patient.
export async function listPatientSessions(patientId, params = {}) {
  const res = await api.get(`/patients/${patientId}/sessions`, { params });
  return res.data.data?.sessions ?? res.data.data ?? [];
}

// PATCH /patients/:id/hide-data — soft-delete the patient (status →
// 'inactive' on the backend). Reversible via activate.
export async function archivePatient(id) {
  await api.delete(`/patients/${id}`);
}

// PATCH /patients/:id/activate — restore an archived patient.
export async function activatePatient(id) {
  await api.patch(`/patients/${id}/activate`);
}

// Hide medical data on the patient — for compliance/redaction. Distinct
// from archive: keeps the row but blanks identifying fields.
export async function hidePatientData(id) {
  await api.patch(`/patients/${id}/hide-data`);
}
export async function unhidePatientData(id) {
  await api.patch(`/patients/${id}/unhide-data`);
}

// GET /patients/:patientId/vital-signs — used on patient detail.
export async function listPatientVitals(patientId, limit = 5) {
  const res = await api.get(`/patients/${patientId}/vital-signs`, {
    params: { limit },
  });
  return res.data.data?.vitalSigns ?? [];
}
