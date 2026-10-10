import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AppLayout from '../optional-layout/AppLayout.jsx';
import { DEFAULT_NAV_ITEMS, STAFF_NAV_ITEMS } from '../optional-layout/Sidebar.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { logout } from '../services/authService.js';

export default function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!data.user) return;
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      if (profileError) throw new Error(profileError.message);
      if (active) setIsStaff(profile.role === 'staff' || profile.role === 'admin');
    }
    loadRole().catch((roleError) => {
      if (active) setError(`Could not load your account role: ${roleError.message}`);
    }).finally(() => {
      if (active) setRoleLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || 'Could not sign out. Please try again.');
    }
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <AppLayout
        items={roleLoading ? [] : isStaff ? STAFF_NAV_ITEMS : DEFAULT_NAV_ITEMS}
        onSignOut={handleSignOut}
      >
        <Outlet />
      </AppLayout>
    </>
  );
}
