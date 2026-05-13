// Activity logs. /activities is gated by VIEW_ACTIVITY_LOGS (superadmin) or
// VIEW_DASHBOARD on the backend. The list supports filters by user, type,
// action, organization, date range.
//
// The backend now returns the standard envelope: { success, message, data }.
// The pre-refactor server returned bare shapes ({ activities, pagination }),
// so we tolerate both for one deploy window.

import { api } from './client';

function unwrap(res, fallback = {}) {
  // Modern envelope first; fall back to the legacy bare shape.
  return res.data?.data ?? res.data ?? fallback;
}

export async function listActivities(params = {}) {
  // Supported params (backend):
  //   userId, type, action, organizationId, search, limit, page,
  //   startDate, endDate.
  const res = await api.get('/activities', { params });
  const d = unwrap(res, { activities: [], pagination: null });
  return { activities: d.activities ?? [], pagination: d.pagination ?? null };
}

export async function getActivity(id) {
  const res = await api.get(`/activities/${id}`);
  const d = unwrap(res, {});
  return d.activity ?? d;
}

// Returns the list of distinct activity_type values present in the DB.
// Used to populate the Type filter chips.
export async function listActivityTypes() {
  const res = await api.get('/activities/types');
  return unwrap(res, {}).activities ?? [];
}

// Returns a slim list of users for the User filter dropdown.
export async function listActivityUsers() {
  const res = await api.get('/activities/users');
  return unwrap(res, {}).users ?? [];
}
