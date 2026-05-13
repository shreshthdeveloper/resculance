import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Info, Search, Filter, Check, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { formatRoleName } from '../../utils/roleUtils';

// Backend role-permission mapping (matching src/config/permissions.js)
const ROLES = {
  SUPERADMIN: 'superadmin',
  HOSPITAL_ADMIN: 'hospital_admin',
  HOSPITAL_DOCTOR: 'hospital_doctor',
  HOSPITAL_PARAMEDIC: 'hospital_paramedic',
  HOSPITAL_STAFF: 'hospital_staff',
  FLEET_ADMIN: 'fleet_admin',
  FLEET_DOCTOR: 'fleet_doctor',
  FLEET_PARAMEDIC: 'fleet_paramedic',
  FLEET_DRIVER: 'fleet_driver',
  FLEET_STAFF: 'fleet_staff'
};

const PERMISSION_CATEGORIES = {
  ORGANIZATIONS: {
    name: 'Organizations',
    permissions: [
      { key: 'view_all_organizations', label: 'View All Organizations', description: 'View all organizations in the system' },
      { key: 'create_organization', label: 'Create Organization', description: 'Create new organizations' },
      { key: 'update_organization', label: 'Update Organization', description: 'Edit organization details' },
      { key: 'delete_organization', label: 'Delete Organization', description: 'Remove organizations' }
    ]
  },
  USERS: {
    name: 'Users',
    permissions: [
      { key: 'view_all_users', label: 'View All Users', description: 'View users across all organizations' },
      { key: 'view_own_org_users', label: 'View Own Organization Users', description: 'View users within own organization' },
      { key: 'create_user', label: 'Create User', description: 'Create new user accounts' },
      { key: 'update_user', label: 'Update User', description: 'Edit user details' },
      { key: 'approve_user', label: 'Approve User', description: 'Approve user registrations (excluding admins)' },
      { key: 'approve_admin', label: 'Approve Admin', description: 'Approve admin user registrations' },
      { key: 'delete_user', label: 'Delete User', description: 'Remove user accounts' }
    ]
  },
  AMBULANCES: {
    name: 'Ambulances',
    permissions: [
      { key: 'view_all_ambulances', label: 'View All Ambulances', description: 'View all ambulances system-wide' },
      { key: 'view_own_ambulances', label: 'View Own Ambulances', description: 'View ambulances within own organization' },
      { key: 'view_assigned_ambulances', label: 'View Assigned Ambulances', description: 'View ambulances assigned to user' },
      { key: 'view_partnered_ambulances', label: 'View Partnered Ambulances', description: 'View ambulances from partner organizations' },
      { key: 'create_ambulance', label: 'Create Ambulance', description: 'Register new ambulances' },
      { key: 'update_ambulance', label: 'Update Ambulance', description: 'Edit ambulance details' },
      { key: 'approve_ambulance', label: 'Approve Ambulance', description: 'Approve ambulance registrations' },
      { key: 'delete_ambulance', label: 'Delete Ambulance', description: 'Remove ambulances' },
      { key: 'assign_staff', label: 'Assign Staff', description: 'Assign staff to ambulances' }
    ]
  },
  PATIENTS: {
    name: 'Patients',
    permissions: [
      { key: 'view_patients', label: 'View Patients', description: 'View patient records' },
      { key: 'create_patient', label: 'Create Patient', description: 'Register new patients' },
      { key: 'update_patient', label: 'Update Patient', description: 'Edit patient information' },
      { key: 'onboard_patient', label: 'Onboard Patient', description: 'Start patient session/transport' },
      { key: 'offboard_patient', label: 'Offboard Patient', description: 'End patient session/transport' },
      { key: 'view_vital_signs', label: 'View Vital Signs', description: 'Monitor patient vital signs' }
    ]
  },
  COLLABORATIONS: {
    name: 'Collaborations',
    permissions: [
      { key: 'view_collaborations', label: 'View Collaborations', description: 'View partnership requests' },
      { key: 'create_collaboration', label: 'Create Collaboration', description: 'Create partnership requests' },
      { key: 'approve_collaboration', label: 'Approve Collaboration', description: 'Approve/accept partnerships' },
      { key: 'reject_collaboration', label: 'Reject Collaboration', description: 'Reject partnership requests' }
    ]
  },
  DASHBOARD: {
    name: 'Dashboard & Analytics',
    permissions: [
      { key: 'view_dashboard', label: 'View Dashboard', description: 'Access dashboard interface' },
      { key: 'view_analytics', label: 'View Analytics', description: 'View detailed analytics and reports' }
    ]
  },
  SYSTEM: {
    name: 'System',
    permissions: [
      { key: 'view_activity_logs', label: 'View Activity Logs', description: 'Access system activity audit logs' }
    ]
  }
};

// Role permissions mapping (matching backend)
const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: Object.values(PERMISSION_CATEGORIES).flatMap(cat => cat.permissions.map(p => p.key)),
  
  [ROLES.HOSPITAL_ADMIN]: [
    'view_own_org_users', 'create_user', 'update_user', 'approve_user',
    'view_own_ambulances', 'view_partnered_ambulances', 'assign_staff',
    'view_patients', 'create_patient', 'update_patient', 'onboard_patient', 'offboard_patient', 'view_vital_signs',
    'view_collaborations', 'create_collaboration', 'approve_collaboration',
    'view_dashboard', 'view_analytics'
  ],
  
  [ROLES.HOSPITAL_DOCTOR]: [
    'view_assigned_ambulances',
    'view_patients', 'create_patient', 'update_patient', 'onboard_patient', 'offboard_patient', 'view_vital_signs',
    'view_dashboard'
  ],
  
  [ROLES.HOSPITAL_PARAMEDIC]: [
    'view_assigned_ambulances',
    'view_patients', 'create_patient', 'update_patient', 'view_vital_signs',
    'view_dashboard'
  ],
  
  [ROLES.HOSPITAL_STAFF]: [
    'view_own_ambulances',
    'view_patients', 'view_vital_signs',
    'view_dashboard'
  ],
  
  [ROLES.FLEET_ADMIN]: [
    'view_own_org_users', 'create_user', 'update_user', 'approve_user',
    'view_own_ambulances', 'create_ambulance', 'update_ambulance', 'delete_ambulance', 'assign_staff',
    'view_collaborations', 'approve_collaboration',
    'view_dashboard', 'view_analytics'
  ],
  
  [ROLES.FLEET_DOCTOR]: [
    'view_assigned_ambulances',
    'view_patients', 'create_patient', 'update_patient', 'view_vital_signs',
    'view_dashboard'
  ],
  
  [ROLES.FLEET_PARAMEDIC]: [
    'view_assigned_ambulances',
    'view_patients', 'create_patient', 'update_patient', 'view_vital_signs',
    'view_dashboard'
  ],
  
  [ROLES.FLEET_DRIVER]: [
    'view_assigned_ambulances',
    'view_dashboard'
  ],
  
  [ROLES.FLEET_STAFF]: [
    'view_own_ambulances',
    'view_dashboard'
  ]
};

export const PermissionsManagement = () => {
  const [selectedRole, setSelectedRole] = useState(ROLES.HOSPITAL_ADMIN);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const roleOptions = Object.entries(ROLES).map(([key, value]) => ({
    value,
    label: formatRoleName(value)
  }));

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => ({
      value: key,
      label: cat.name
    }))
  ];

  const hasPermission = (permissionKey) => {
    return ROLE_PERMISSIONS[selectedRole]?.includes(permissionKey) || false;
  };

  const filteredCategories = Object.entries(PERMISSION_CATEGORIES).filter(([key, category]) => {
    if (selectedCategory !== 'all' && key !== selectedCategory) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return category.permissions.some(p => 
        p.label.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getPermissionCount = () => {
    const total = Object.values(PERMISSION_CATEGORIES).reduce(
      (sum, cat) => sum + cat.permissions.length, 
      0
    );
    const granted = ROLE_PERMISSIONS[selectedRole]?.length || 0;
    return { granted, total };
  };

  const { granted, total } = getPermissionCount();
  const percentage = Math.round((granted / total) * 100);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text">Permissions Management</h1>
            <p className="text-text-secondary">Role-based access control configuration</p>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="mb-6 bg-info/10 border-info/30">
          <div className="flex items-start gap-3 p-4">
            <Info className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text mb-1">About Permissions</p>
              <p>
                This page displays the permission matrix for each role in the system. 
                Permissions are configured in the backend and control what actions users can perform.
                Super Admin has all permissions by default.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="mb-6">
          <div className="p-6 space-y-4">
            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Select Role
              </label>
              <Select
                value={roleOptions.find(opt => opt.value === selectedRole)}
                onChange={(option) => setSelectedRole(option?.value || ROLES.HOSPITAL_ADMIN)}
                options={roleOptions}
                className="max-w-sm"
              />
            </div>

            {/* Permission Stats */}
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text">Permission Coverage</span>
                <span className="text-sm font-semibold text-primary">{percentage}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-primary to-primary-dark"
                />
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                {granted} of {total} permissions granted
              </div>
            </div>

            {/* Search & Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input
                  type="text"
                  placeholder="Search permissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none z-10" />
                <Select
                  value={categoryOptions.find(opt => opt.value === selectedCategory)}
                  onChange={(option) => setSelectedCategory(option?.value || 'all')}
                  options={categoryOptions}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Permissions Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        {filteredCategories.map(([categoryKey, category], idx) => (
          <Card key={categoryKey}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-sm font-bold">
                  {category.permissions.filter(p => hasPermission(p.key)).length}
                </span>
                {category.name}
                <span className="text-xs text-text-secondary font-normal ml-2">
                  ({category.permissions.filter(p => hasPermission(p.key)).length}/{category.permissions.length})
                </span>
              </h3>

              <div className="space-y-2">
                {category.permissions
                  .filter(permission => {
                    if (!searchTerm) return true;
                    const term = searchTerm.toLowerCase();
                    return permission.label.toLowerCase().includes(term) || 
                           permission.description.toLowerCase().includes(term);
                  })
                  .map((permission, permIdx) => {
                    const granted = hasPermission(permission.key);
                    return (
                      <motion.div
                        key={permission.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * permIdx }}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                          granted
                            ? 'bg-success/5 border-success/30'
                            : 'bg-background border-border hover:border-border-hover'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          granted ? 'bg-success text-white' : 'bg-border text-text-secondary'
                        }`}>
                          {granted ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-medium mb-1 ${granted ? 'text-text' : 'text-text-secondary'}`}>
                            {permission.label}
                          </h4>
                          <p className="text-sm text-text-secondary">
                            {permission.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </Card>
        ))}

        {filteredCategories.length === 0 && (
          <Card>
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary">No permissions found matching your search</p>
            </div>
          </Card>
        )}
      </motion.div>
    </div>
  );
};
