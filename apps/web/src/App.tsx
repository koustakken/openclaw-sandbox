import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GuestOnlyRoute } from './components/GuestOnlyRoute';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HealthPage } from './pages/HealthPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

const router = createBrowserRouter(
  [
    {
      element: <GuestOnlyRoute />,
      children: [{ path: '/login', element: <LoginPage /> }]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'health', element: <HealthPage /> },
            { path: 'profile', element: <ProfilePage /> }
          ]
        }
      ]
    },
    {
      path: '*',
      element: <Navigate to="/login" replace />
    }
  ],
  {
    basename: import.meta.env.BASE_URL
  }
);

export function App() {
  return <RouterProvider router={router} />;
}
