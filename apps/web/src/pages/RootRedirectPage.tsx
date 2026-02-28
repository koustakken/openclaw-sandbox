import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';

export function RootRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    api
      .getProfile()
      .then((profile) => {
        if (!active) return;
        navigate(`/${profile.username}`, { replace: true });
      })
      .catch(() => {
        if (!active) return;
        navigate('/login', { replace: true });
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  return <p>Loading profile...</p>;
}
