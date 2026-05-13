import { Ambulance as AmbulanceIcon, UserPlus } from 'lucide-react';
import { Card } from '../ui/Card';

export default function DetailsCard({ session }) {
  return (
    <Card className="p-2 flex flex-col h-full overflow-hidden">
      <h3 className="text-[10px] font-semibold text-text mb-1 flex items-center gap-1">
        <AmbulanceIcon className="w-3 h-3" /> Vehicle
      </h3>
      
      {/* Ambulance Details */}
      <div className="mb-1.5 pb-1.5 border-b border-border">
        <div className="grid grid-cols-2 gap-1">
          <div>
            <p className="text-[8px] text-secondary mb-0.5">Reg</p>
            <p className="text-[9px] font-medium text-text truncate">
              {session.ambulance_code || session.ambulanceCode || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-[8px] text-secondary mb-0.5">Type</p>
            <p className="text-[9px] font-medium text-text truncate">
              {session.vehicle_type || session.vehicleType || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Crew Members */}
      <div className="flex-1 overflow-y-auto">
        {session.crew && session.crew.length > 0 ? (
          <div className="space-y-1">
            {session.doctors && session.doctors.length > 0 && (
              <div>
                <p className="text-[8px] text-secondary mb-0.5">Doctors</p>
                <div className="flex flex-wrap gap-0.5">
                  {session.doctors.map((doc) => (
                    <span 
                      key={doc.id} 
                      className="px-1 py-0.5 rounded text-[8px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                    >
                      {(doc.first_name || doc.firstName || '').split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {session.paramedics && session.paramedics.length > 0 && (
              <div>
                <p className="text-[8px] text-secondary mb-0.5">Paramedics</p>
                <div className="flex flex-wrap gap-0.5">
                  {session.paramedics.map((para) => (
                    <span 
                      key={para.id} 
                      className="px-1 py-0.5 rounded text-[8px] font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    >
                      {(para.first_name || para.firstName || '').split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[9px] text-secondary">No crew</p>
        )}
      </div>
    </Card>
  );
}
