import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasPermission, hasAnyPermission } from '../utils/permissions';

export const ProtectedRoute = ({ children, requiredPermission, requiredPermissions = [], requireAll = false }) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required permission(s)
  if (requiredPermission) {
    if (!hasPermission(user?.role, requiredPermission)) {
      // Redirect to dashboard if user doesn't have permission
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? requiredPermissions.every(perm => hasPermission(user?.role, perm))
      : hasAnyPermission(user?.role, ...requiredPermissions);
    
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};
