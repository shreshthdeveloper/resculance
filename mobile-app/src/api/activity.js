// Activity logs. /activities is gated by VIEW_ACTIVITY_LOGS (superadmin) or
// VIEW_DASHBOARD on the backend. The list supports filters by user, type,
// action, organization, date range.
//
// NOTE: the activity controller returns BARE shapes (no `{ success, data }`
// envelope) — e.g. `{ activities, pagination }` and `{ activities: [...] }`
// for the distinct-types endpoint. Read from `res.data` directly.

import { api } from './client';

export async function listActivities(params = {}) {
  // Supported params (backend):
  //   userId, type, action, organizationId, search, limit, page,
  //   startDate, endDate.
  const res = await api.get('/activities', { params });
  return res.data ?? { activities: [], pagination: null };
}

export async function getActivity(id) {
  const res = await api.get(`/activities/${id}`);
  return res.data?.activity ?? res.data;
}

// Returns the list of distinct activity_type values present in the DB.
// Used to populate the Type filter chips. Backend returns { activities: [...] }.
export async function listActivityTypes() {
  const res = await api.get('/activities/types');
  return res.data?.activities ?? [];
}

// Returns a slim list of users for the User filter dropdown.
export async function listActivityUsers() {
  const res = await api.get('/activities/users');
  return res.data?.users ?? [];
}
