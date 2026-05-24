import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data ?? null;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // getSession resuelve el loading inmediatamente sin esperar perfil
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).then(setProfile).catch(() => setProfile(null));
      }
      setLoading(false);
      setInitialized(true);
    }).catch(() => {
      setLoading(false);
      setInitialized(true);
    });

    // onAuthStateChange solo maneja LOGIN/LOGOUT posteriores
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            fetchProfile(session.user.id).then(setProfile).catch(() => setProfile(null));
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email, password, fullName) => {
    try {
      setLoading(true);
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      if (signUpError) throw signUpError;
      return { user: authData.user, error: null };
    } catch (err) {
      setError(err.message);
      return { user: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) throw signInError;
      return { user: data.user, error: null };
    } catch (err) {
      setError(err.message);
      return { user: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      setProfile(null);
      return { error: null };
    } catch (err) {
      setError(err.message);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return {
    user,
    profile,
    loading,
    initialized,
    error,
    signUp,
    signIn,
    signOut,
    isAdmin
  };
}
