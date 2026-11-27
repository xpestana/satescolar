import { useEffect, useRef } from "react";
import { verifyServerSession } from "@/lib/sessionGuard";

/** Minimum time between two checks triggered by the tab becoming visible again. */
export const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Confirms with Supabase Auth that the signed-in session still exists: once when a user is
 * present and again whenever the tab becomes visible (at most every few minutes). A session that
 * was revoked on the server is cleared locally, so the user goes to the login screen instead of
 * using an app where every Edge Function answers "No autorizado".
 */
export function useServerSessionCheck(
  userId: string | null | undefined,
  /** Also run when the tab comes back after the interval (e.g. refresh the user's context). */
  onTabReturn?: () => void,
): void {
  const onTabReturnRef = useRef(onTabReturn);
  onTabReturnRef.current = onTabReturn;

  useEffect(() => {
    if (!userId) return;

    let lastCheck = Date.now();
    void verifyServerSession();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < SESSION_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      void verifyServerSession();
      onTabReturnRef.current?.();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [userId]);
}
