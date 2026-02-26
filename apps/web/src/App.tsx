import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { HealthPage } from './pages/HealthPage';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'health', element: <HealthPage /> }
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
