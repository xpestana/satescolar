import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useServerSessionCheck } from '@/hooks/useServerSessionCheck';
import {
  type AppRole,
  type UserContext,
  clearCachedContext,
  parseUserContext,
  readCachedContext,
  writeCachedContext,
} from '@/lib/userContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole | null;
  /** Role, school, modules and permissions of the signed-in user (see `get_my_context`). */
  context: UserContext | null;
  /** Asks the database again (e.g. after a module or permission change). */
  refreshContext: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ContextLookup = { ok: true; context: UserContext } | { ok: false };

const ROLE_RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Fetches the user's context in one request. `ok: false` means the lookup itself failed (network,
 * expired token…), which is NOT the same as "this user has no role" — callers must not treat it as
 * a sign-out.
 */
async function fetchContextOnce(): Promise<ContextLookup> {
  try {
    const { data, error } = await supabase.rpc('get_my_context');
    if (error) {
      console.error("Error fetching user context:", error);
      return { ok: false };
    }
    return { ok: true, context: parseUserContext(data) };
  } catch (error) {
    console.error("Exception fetching user context:", error);
    return { ok: false };
  }
}

/** Retries transient failures a few times before giving up. */
async function fetchContext(isCurrent: () => boolean): Promise<ContextLookup> {
  let result = await fetchContextOnce();
  for (const delay of ROLE_RETRY_DELAYS_MS) {
    if (result.ok || !isCurrent()) return result;
    await new Promise((r) => setTimeout(r, delay));
    if (!isCurrent()) return result;
    result = await fetchContextOnce();
  }
  return result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<UserContext | null>(null);
  const roleRequestRef = useRef(0);
  // Last context confirmed by the database, and whose it is. A user's role does not change during a
  // session, so a later SIGNED_IN for the same user (supabase-js emits one every time the tab
  // regains focus) must not blank it: a failed lookup at that moment used to set the role to null,
  // which emptied the sidebar and showed the "module not active" overlay to schools that have it.
  const confirmedRef = useRef<{ userId: string; context: UserContext } | null>(null);
  // One lookup per user at a time: getSession() and the SIGNED_IN that follows a login both ask.
  const inflightRef = useRef<{ userId: string; promise: Promise<ContextLookup> } | null>(null);
  // User of the latest session seen; a shared lookup keeps retrying while it is still this user.
  const latestUserIdRef = useRef<string | null>(null);

  const lookup = useCallback((userId: string) => {
    const inflight = inflightRef.current;
    if (inflight && inflight.userId === userId) return inflight.promise;
    const promise = fetchContext(() => latestUserIdRef.current === userId).finally(() => {
      if (inflightRef.current?.promise === promise) inflightRef.current = null;
    });
    inflightRef.current = { userId, promise };
    return promise;
  }, []);

  /** Stores a confirmed answer for this user (state, ref and browser cache). */
  const confirm = useCallback((userId: string, next: UserContext) => {
    confirmedRef.current = { userId, context: next };
    writeCachedContext(userId, next);
    setContext(next);
  }, []);

  const clearAll = useCallback(() => {
    roleRequestRef.current += 1;
    latestUserIdRef.current = null;
    confirmedRef.current = null;
    inflightRef.current = null;
    clearCachedContext();
    setContext(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      const requestId = ++roleRequestRef.current;

      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      latestUserIdRef.current = nextSession?.user?.id ?? null;

      if (!nextSession?.user) {
        confirmedRef.current = null;
        setContext(null);
        setLoading(false);
        return;
      }

      const userId = nextSession.user.id;
      const confirmed = confirmedRef.current;
      if (confirmed && confirmed.userId === userId && confirmed.context.role) {
        // Same user, context already known: nothing to look up.
        setContext(confirmed.context);
        setLoading(false);
        return;
      }

      // Paint at once with what this browser remembers for THIS user, then revalidate.
      const cached = readCachedContext(userId);
      if (cached?.role) {
        setContext(cached);
        setLoading(false);
      } else {
        setContext(null);
        setLoading(true);
      }

      const isCurrent = () => mounted && roleRequestRef.current === requestId;
      const result = await lookup(userId);

      if (!isCurrent()) return;

      if (result.ok) {
        confirm(userId, result.context);
      } else if (!cached?.role && !(confirmed && confirmed.userId === userId)) {
        // Could not tell, and there is nothing known for this user: same as before (no role).
        setContext(null);
      }
      // Otherwise keep what is already shown for this user.
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // Skip the initial session event; handled by getSession() below.
        if (event === 'INITIAL_SESSION') return;

        // Token refresh / profile update — only update session tokens, never
        // touch the role so components don't re-render their guards.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        // Explicit sign-out: clear everything, including this browser's cached context.
        if (event === 'SIGNED_OUT') {
          clearAll();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // SIGNED_IN or any other event with a valid user.
        if (session?.user) {
          void applySession(session);
          return;
        }

        // Any other event without a user — treat as sign-out.
        clearAll();
        setSession(null);
        setUser(null);
        setLoading(false);
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
  }, [lookup, confirm, clearAll]);

  const refreshContext = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const result = await lookup(userId);
    if (result.ok && user?.id === userId) confirm(userId, result.context);
  }, [user?.id, lookup, confirm]);

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

  // Page reloads and tab refocus confirm the session still exists on the server (see sessionGuard).
  // Modules or permissions can change while the app is open, so the context is refreshed too.
  useServerSessionCheck(user?.id, () => void refreshContext());

  const signOut = async () => {
    // Local scope: end only THIS browser's session. supabase-js defaults to "global", which deletes
    // every session of the user on the server. When an admin ended an impersonation that way, the
    // real user's session died too: lists kept loading but every Edge Function answered
    // "No autorizado" (no names/emails in Usuarios y Permisos, could not create sub-users).
    await supabase.auth.signOut({ scope: 'local' });
    clearAll();
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
        userRole: context?.role ?? null,
        context,
        refreshContext,
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
