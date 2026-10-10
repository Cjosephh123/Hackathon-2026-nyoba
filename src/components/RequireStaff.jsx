import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

export default function RequireStaff({ children }) {
  const [state, setState] = useState({ loading: true, allowed: false, error: '' });

  useEffect(() => {
    let active = true;
    async function checkRole() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!userData.user) {
        if (active) setState({ loading: false, allowed: false, error: '' });
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();
      if (profileError) throw new Error(profileError.message);
      if (active) {
        setState({
          loading: false,
          allowed: profile.role === 'staff' || profile.role === 'admin',
          error: '',
        });
      }
    }

    checkRole().catch((error) => {
      if (active) setState({ loading: false, allowed: false, error: error.message });
    });
    return () => {
      active = false;
    };
  }, []);

  if (state.loading) return <p role="status">Checking staff access…</p>;
  if (state.error) return <p role="alert">Could not verify staff access: {state.error}</p>;
  if (!state.allowed) return <Navigate to="/" replace />;
  return children;
}
