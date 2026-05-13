import { api } from './client';

// GET /dashboard/stats — returns a shape that varies by role:
//   superadmin: { totalOrganizations, totalHospitals, totalFleets, totalUsers,
//                 totalAmbulances, activeTrips, totalPatients, totalCollaborations }
//   hospital/fleet: subset of the above scoped to their org.
// All fields are integers; the screen renders only what's present.
export async function getDashboardStats() {
  const res = await api.get('/dashboard/stats');
  return res.data.data ?? {};
}
