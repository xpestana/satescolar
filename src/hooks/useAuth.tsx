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

type RoleLookup = { ok: true; role: AppRole | null } | { ok: false };

const ROLE_RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Fetches the user's role. `ok: false` means the lookup itself failed (network, expired token…),
 * which is NOT the same as "this user has no role" — callers must not treat it as a sign-out.
 */
async function fetchUserRoleOnce(userId: string): Promise<RoleLookup> {
  try {
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching role:", error);
      return { ok: false };
    }

    return { ok: true, role: (roleData?.role as AppRole) || null };
  } catch (error) {
    console.error("Exception fetching role:", error);
    return { ok: false };
  }
}

/** Retries transient failures a few times before giving up. */
async function fetchUserRole(userId: string, isCurrent: () => boolean): Promise<RoleLookup> {
  let result = await fetchUserRoleOnce(userId);
  for (const delay of ROLE_RETRY_DELAYS_MS) {
    if (result.ok || !isCurrent()) return result;
    await new Promise((r) => setTimeout(r, delay));
    if (!isCurrent()) return result;
    result = await fetchUserRoleOnce(userId);
  }
  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const roleRequestRef = useRef(0);
  // Last role confirmed by the database, and whose it is. A user's role does not change during a
  // session, so a later SIGNED_IN for the same user (supabase-js emits one every time the tab
  // regains focus) must not blank it: a failed lookup at that moment used to set the role to null,
  // which emptied the sidebar and showed the "module not active" overlay to schools that have it.
  const confirmedRoleRef = useRef<{ userId: string; role: AppRole | null } | null>(null);

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null, isInitial = false) => {
      const requestId = ++roleRequestRef.current;

      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        confirmedRoleRef.current = null;
        setUserRole(null);
        setLoading(false);
        return;
      }

      const userId = nextSession.user.id;
      const confirmed = confirmedRoleRef.current;
      if (confirmed && confirmed.userId === userId && confirmed.role) {
        // Same user, role already known: nothing to look up.
        setUserRole(confirmed.role);
        setLoading(false);
        return;
      }

      if (isInitial) setLoading(true);
      const isCurrent = () => mounted && roleRequestRef.current === requestId;
      const result = await fetchUserRole(userId, isCurrent);

      if (!isCurrent()) return;

      if (result.ok) {
        confirmedRoleRef.current = { userId, role: result.role };
        setUserRole(result.role);
      } else if (!(confirmed && confirmed.userId === userId)) {
        // Could not tell, and there is nothing known for this user: same as before (no role).
        setUserRole(null);
      }
      // Otherwise keep the role already in state for this user.
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event, session?.user?.email);

        if (!mounted) return;

        // Skip the initial session event; handled by getSession() below.
        if (event === 'INITIAL_SESSION') return;

        // Token refresh / profile update — only update session tokens, never
        // touch userRole so components don't re-render their guards.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        // Explicit sign-out: clear everything.
        if (event === 'SIGNED_OUT') {
          roleRequestRef.current += 1;
          confirmedRoleRef.current = null;
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          return;
        }

        // SIGNED_IN or any other event with a valid user.
        if (session?.user) {
          void applySession(session, false);
          return;
        }

        // Any other event without a user — treat as sign-out.
        roleRequestRef.current += 1;
        confirmedRoleRef.current = null;
        setSession(null);
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      void applySession(session, true);
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
    confirmedRoleRef.current = null;
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