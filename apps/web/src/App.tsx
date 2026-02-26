import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HealthPage } from './pages/HealthPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'health', element: <HealthPage /> },
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <RegisterPage /> },
        {
          element: <ProtectedRoute />,
          children: [{ path: 'profile', element: <ProfilePage /> }]
        },
        { path: '*', element: <NotFoundPage /> }
      ]
    }
  ],
  {
    basename: import.meta.env.BASE_URL
  }
);

export function App() {
  return <RouterProvider router={router} />;
}
