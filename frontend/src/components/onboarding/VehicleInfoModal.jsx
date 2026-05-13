import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, Users, Phone, MapPin } from 'lucide-react';
import { Card } from '../ui/Card';

export default function VehicleInfoModal({ isOpen, onClose, session, ambulance }) {
  if (!isOpen) return null;

  // Use actual ambulance data from props
  const ambulanceInfo = {
    code: session?.ambulance_code || session?.ambulanceCode || 'N/A',
    registration: ambulance?.registration_number || ambulance?.registrationNumber || 'N/A',
    model: ambulance?.model || 'N/A',
    type: ambulance?.type || 'Basic Life Support',
  };

  // Build crew members array from session data (doctors, paramedics, drivers)
  const crewMembers = [];
  
  // Add doctors
  if (session?.doctors && Array.isArray(session.doctors)) {
    session.doctors.forEach(doc => {
      crewMembers.push({
        id: doc.id,
        name: `${doc.first_name || doc.firstName || ''} ${doc.last_name || doc.lastName || ''}`.trim(),
        role: 'Doctor',
        phone: doc.phone || doc.phone_number || 'N/A'
      });
    });
  }
  
  // Add paramedics
  if (session?.paramedics && Array.isArray(session.paramedics)) {
    session.paramedics.forEach(para => {
      crewMembers.push({
        id: para.id,
        name: `${para.first_name || para.firstName || ''} ${para.last_name || para.lastName || ''}`.trim(),
        role: 'Paramedic',
        phone: para.phone || para.phone_number || 'N/A'
      });
    });
  }
  
  // Add drivers
  if (session?.drivers && Array.isArray(session.drivers)) {
    session.drivers.forEach(driver => {
      crewMembers.push({
        id: driver.id,
        name: `${driver.first_name || driver.firstName || ''} ${driver.last_name || driver.lastName || ''}`.trim(),
        role: 'Driver',
        phone: driver.phone || driver.phone_number || 'N/A'
      });
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
          />
          
          {/* Modal Container - Centered */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-4xl pointer-events-auto"
            >
              <Card className="bg-white dark:bg-gray-900 shadow-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 px-6 py-5 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Truck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Vehicle & Crew Information</h2>
                        <p className="text-sm text-slate-300 mt-0.5">
                          Real-time ambulance details
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                  {/* Vehicle Details */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <Truck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-text">Ambulance Details</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Ambulance Code</p>
                        <p className="text-lg font-bold text-text">{ambulanceInfo.code}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Registration Number</p>
                        <p className="text-lg font-bold text-text">{ambulanceInfo.registration}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Vehicle Model</p>
                        <p className="text-lg font-bold text-text">{ambulanceInfo.model}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type</p>
                        <p className="text-lg font-bold text-text">{ambulanceInfo.type}</p>
                      </div>
                    </div>
                  </div>

                  {/* Crew Members */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <Users className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-text">Crew Members</h3>
                        <p className="text-xs text-text-secondary">Medical team on board</p>
                      </div>
                      <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold">
                        {crewMembers.length}
                      </div>
                    </div>
                    {crewMembers.length === 0 ? (
                      <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                        <p className="text-base font-medium text-text-secondary">No crew members assigned</p>
                        <p className="text-sm text-text-secondary mt-1">Crew information will appear here when assigned</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {crewMembers.map((member) => (
                          <div
                            key={member.id}
                            className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center shadow-md">
                                <span className="text-base font-bold text-white">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-text truncate">{member.name}</p>
                                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                                  member.role === 'Doctor' 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : member.role === 'Paramedic'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                }`}>
                                  {member.role}
                                </span>
                              </div>
                            </div>
                            <a
                              href={`tel:${member.phone}`}
                              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                            >
                              <Phone className="w-4 h-4" />
                              <span>{member.phone}</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
