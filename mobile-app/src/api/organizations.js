// Organization list / lookup. Only useful for superadmin in the mobile app —
// non-superadmins are scoped to their own org and don't need to pick one.
//
// Backend: GET /organizations returns { organizations, pagination }. Filters:
//   type: 'hospital' | 'fleet_owner'
//   status: 'active' | ...
// We always limit to active orgs and ask for a generous page size (200) so
// the dropdown doesn't need its own pagination — the universe of orgs is
// small.

import { api } from './client';

export async function listOrganizations({ type, limit = 200 } = {}) {
  const params = { limit, status: 'active' };
  if (type) params.type = type;
  const res = await api.get('/organizations', { params });
  return res.data?.data?.organizations ?? [];
}
