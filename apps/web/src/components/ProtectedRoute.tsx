import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loading } from './Loading';
import type { AuthRole } from '../lib/auth';

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: AuthRole[] }) {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'worker' ? '/worker-attendance' : '/'} replace />;
  }

  return <>{children}</>;
}
