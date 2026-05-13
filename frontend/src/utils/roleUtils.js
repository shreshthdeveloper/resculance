/**
 * Format role name for display
 * Converts backend role strings to human-readable format
 * 
 * Examples:
 * - 'superadmin' -> 'Super Admin'
 * - 'hospital_admin' -> 'Hospital Admin'
 * - 'senior_doctor' -> 'Senior Doctor'
 * - 'fleet_admin' -> 'Fleet Admin'
 */
export const formatRoleName = (role) => {
  if (!role) return '';
  
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get color class for role badge/display
 * Uses theme CSS variables for consistency
 */
export const getRoleColor = (role) => {
  if (!role) return 'text-text-secondary';
  
  const roleLower = role.toLowerCase();
  
  if (roleLower.includes('admin')) return 'text-primary';
  if (roleLower.includes('doctor')) return 'text-success';
  if (roleLower.includes('paramedic')) return 'text-info';
  if (roleLower.includes('driver')) return 'text-warning';
  
  return 'text-text-secondary';
};

/**
 * Get role display object with formatted name and color
 */
export const getRoleDisplay = (role) => {
  return {
    name: formatRoleName(role),
    color: getRoleColor(role)
  };
};
