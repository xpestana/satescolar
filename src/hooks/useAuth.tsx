import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'school' | 'representative' | 'teacher';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to fetch user role
async function fetchUserRole(userId: string): Promise<AppRole | null> {
  try {
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching role:", error);
      return null;
    }
    
    return roleData?.role as AppRole || null;
  } catch (error) {
    console.error("Exception fetching role:", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const roleRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      const requestId = ++roleRequestRef.current;

      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const role = await fetchUserRole(nextSession.user.id);

      if (!mounted || roleRequestRef.current !== requestId) return;

      setUserRole(role);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event, session?.user?.email);

        if (!mounted) return;

        if (event === 'INITIAL_SESSION') {
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        if (!session?.user) {
          roleRequestRef.current += 1;
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          return;
        }

        void applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      void applySession(session);
    });

    return () => {
      mounted = false;
      roleRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userRole,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}