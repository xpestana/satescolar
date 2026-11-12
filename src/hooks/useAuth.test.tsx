import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";

type Listener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  initialSession: null as unknown,
  /** Queue of answers for the user_roles lookup; "fail" simulates a failed request. */
  roleAnswers: [] as ("fail" | string | null)[],
  roleCalls: 0,
}));

vi.mock("@/integrations/supabase/client", () => {
  const maybeSingle = vi.fn(async () => {
    h.roleCalls += 1;
    const answer = h.roleAnswers.length > 0 ? h.roleAnswers.shift() : "fail";
    if (answer === "fail") return { data: null, error: { message: "JWT expired" } };
    return { data: answer ? { role: answer } : null, error: null };
  });
  return {
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
      auth: {
        onAuthStateChange: (cb: Listener) => {
          h.listener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({ data: { session: h.initialSession } }),
        signOut: async () => ({ error: null }),
      },
    },
  };
});

const session = (id: string) => ({ user: { id, email: `${id}@example.com` } });

function Probe() {
  const { userRole, loading } = useAuth();
  return <p>{loading ? "loading" : `role:${userRole ?? "none"}`}</p>;
}

beforeEach(() => {
  vi.useRealTimers();
  h.listener = null;
  h.initialSession = session("u1");
  h.roleAnswers = [];
  h.roleCalls = 0;
});

describe("AuthProvider role", () => {
  it("keeps the role when the same user signs in again (tab refocus) even if the lookup would fail", async () => {
    h.roleAnswers = ["school"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("role:school");

    // From now on every lookup fails, like an expired token right after waking the PC.
    h.roleAnswers = [];
    await act(async () => h.listener!("SIGNED_IN", session("u1")));
    expect(screen.getByText("role:school")).toBeInTheDocument();
    expect(h.roleCalls).toBe(1); // no new lookup for the same user
  });

  it("retries a failed lookup before giving up", async () => {
    h.roleAnswers = ["fail", "school"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("role:school")).toBeInTheDocument(), { timeout: 3000 });
    expect(h.roleCalls).toBe(2);
  });

  it("looks the role up again for a different user and clears it on sign-out", async () => {
    h.roleAnswers = ["school", "teacher"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("role:school");

    await act(async () => h.listener!("SIGNED_IN", session("u2")));
    await screen.findByText("role:teacher");

    await act(async () => h.listener!("SIGNED_OUT", null));
    expect(screen.getByText("role:none")).toBeInTheDocument();
  });
});
