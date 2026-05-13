const {
  Organization, User, Ambulance, PatientSession, Patient, CollaborationRequest, Partnership
} = require('../models');
const { success } = require('../utils/response');

/**
 * Dashboard counts.
 *
 * - superadmin sees system-wide counts
 * - fleet_owner sees their own org (their ambulances, their trips, their patients carried)
 * - hospital sees a hospital-flavoured view: their patients in their org, trips where they
 *   own the session OR are the destination, and ambulances they own + ambulances they're
 *   partnered with via an active partnership (so the number isn't always zero).
 */
class DashboardController {
  static async getStats(req, res, next) {
    try {
      const { role, organizationId, organizationType } = req.user;

      if (role === 'superadmin') {
        const [
          totalOrganizations, totalHospitals, totalFleets,
          totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
        ] = await Promise.all([
          Organization.countDocuments({ status: 'active' }),
          Organization.countDocuments({ type: 'hospital', status: 'active' }),
          Organization.countDocuments({ type: 'fleet_owner', status: 'active' }),
          User.countDocuments({ status: 'active' }),
          Ambulance.countDocuments({ status: { $in: ['active', 'available'] } }),
          PatientSession.countDocuments({ status: { $in: ['onboarded', 'in_transit'] } }),
          Patient.countDocuments({}),
          CollaborationRequest.countDocuments({ status: 'approved' })
        ]);
        return success(res, 'OK', {
          totalOrganizations, totalHospitals, totalFleets,
          totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
        });
      }

      if (organizationType === 'hospital') {
        // Build the set of ambulance ids the hospital can see: own + partnered fleets'
        const partnerships = await Partnership.find({
          hospital_id: organizationId,
          status: 'active'
        }).select('fleet_id').lean();
        const partneredFleetIds = partnerships.map((p) => p.fleet_id);

        const visibleAmbulanceIds = await Ambulance.find({
          $or: [
            { organization_id: organizationId },
            { organization_id: { $in: partneredFleetIds } }
          ],
          status: { $in: ['active', 'available'] }
        }).distinct('_id');

        const [
          totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
        ] = await Promise.all([
          User.countDocuments({ organization_id: organizationId, status: 'active' }),
          // Show partnered+own ambulances so the number is meaningful for hospital admins
          Promise.resolve(visibleAmbulanceIds.length),
          PatientSession.countDocuments({
            $or: [
              { organization_id: organizationId },
              { destination_hospital_id: organizationId }
            ],
            status: { $in: ['onboarded', 'in_transit'] }
          }),
          Patient.countDocuments({ organization_id: organizationId, is_active: true }),
          CollaborationRequest.countDocuments({
            hospital_id: organizationId,
            status: 'approved'
          })
        ]);
        return success(res, 'OK', {
          totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
        });
      }

      // fleet_owner (default) — count via the fleet's own ambulances
      const orgAmbulanceIds = await Ambulance.find({ organization_id: organizationId }).distinct('_id');
      const [
        totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
      ] = await Promise.all([
        User.countDocuments({ organization_id: organizationId, status: 'active' }),
        Ambulance.countDocuments({
          organization_id: organizationId,
          status: { $in: ['active', 'available'] }
        }),
        PatientSession.countDocuments({
          ambulance_id: { $in: orgAmbulanceIds },
          status: { $in: ['onboarded', 'in_transit'] }
        }),
        PatientSession.distinct('patient_id', { ambulance_id: { $in: orgAmbulanceIds } })
          .then((ids) => ids.length),
        CollaborationRequest.countDocuments({
          fleet_id: organizationId,
          status: 'approved'
        })
      ]);
      return success(res, 'OK', {
        totalUsers, totalAmbulances, activeTrips, totalPatients, totalCollaborations
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = DashboardController;
