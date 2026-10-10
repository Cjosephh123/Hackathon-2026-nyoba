import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

export default function RequireAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (active) {
        setSession(nextSession);
        setLoading(false);
        setError('');
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || receivedAuthEvent) return;
        if (sessionError) {
          setError(sessionError.message);
        } else {
          setSession(data.session);
        }
        setLoading(false);
      })
      .catch((sessionError) => {
        if (!active || receivedAuthEvent) return;
        setError(sessionError.message || 'Could not verify your sign-in session.');
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) return <main role="status">Checking your sign-in…</main>;
  if (error) return <main role="alert">Could not verify your sign-in: {error}</main>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
