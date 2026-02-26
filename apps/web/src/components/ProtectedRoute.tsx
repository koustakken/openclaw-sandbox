import { Navigate, Outlet } from 'react-router-dom';
import { authStorage } from '../shared/authStorage';

export function ProtectedRoute() {
  const token = authStorage.getAccessToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
