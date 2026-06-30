import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface AdminProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  role: 'user' | 'professional' | 'admin';
}

export function useAdminAuth(redirectToLogin: boolean = true) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (active) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            if (redirectToLogin) navigate('/login');
          }
          return;
        }

        const currentUser = session.user;
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, role')
          .eq('id', currentUser.id)
          .single();

        if (error || !profileData || (profileData.role !== 'admin' && profileData.role !== 'professional')) {
          console.warn('Unauthorized: User is not an admin/professional', profileData);
          if (active) {
            setUser(currentUser);
            setProfile(profileData as AdminProfile | null);
            setLoading(false);
            if (redirectToLogin) {
              await supabase.auth.signOut();
              navigate('/login');
            }
          }
          return;
        }

        if (active) {
          setUser(currentUser);
          setProfile(profileData as AdminProfile);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error in checkAuth:', err);
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (active) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          if (redirectToLogin) navigate('/login');
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAuth();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, redirectToLogin]);

  return { user, profile, loading, isAdmin: profile?.role === 'admin' || profile?.role === 'professional' };
}
