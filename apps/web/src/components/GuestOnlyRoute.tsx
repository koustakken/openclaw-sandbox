import { Navigate, Outlet } from 'react-router-dom';
import { authStorage } from '../shared/authStorage';

export function GuestOnlyRoute() {
  const token = authStorage.getAccessToken();

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
