import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GuestOnlyRoute } from './components/GuestOnlyRoute';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { RootRedirectPage } from './pages/RootRedirectPage';

const router = createBrowserRouter(
  [
    {
      element: <GuestOnlyRoute />,
      children: [
        { path: '/login', element: <LoginPage /> },
        { path: '/register', element: <RegisterPage /> }
      ]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/',
          element: <Layout />,
          children: [
            { index: true, element: <RootRedirectPage /> },
            { path: 'profile', element: <ProfilePage /> },
            { path: ':username', element: <HomePage /> },
            { path: '*', element: <NotFoundPage /> }
          ]
        }
      ]
    },
    { path: '*', element: <Navigate to="/login" replace /> }
  ],
  {
    basename: import.meta.env.BASE_URL
  }
);

export function App() {
  return <RouterProvider router={router} />;
}
