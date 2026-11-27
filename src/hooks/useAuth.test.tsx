import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";
import { USER_CONTEXT_STORAGE_KEY, parseUserContext, writeCachedContext } from "@/lib/userContext";

type Listener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  initialSession: null as unknown,
  /** Queue of roles answered by get_my_context; "fail" simulates a failed request. */
  roleAnswers: [] as ("fail" | string | null)[],
  roleCalls: 0,
  /** When set, the next get_my_context call waits on this promise. */
  gate: null as null | Promise<void>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async () => {
    h.roleCalls += 1;
    if (h.gate) await h.gate;
    const answer = h.roleAnswers.length > 0 ? h.roleAnswers.shift() : "fail";
    if (answer === "fail") return { data: null, error: { message: "JWT expired" } };
    return { data: answer ? { role: answer, school_id: "sc1", role_school_id: "sc1" } : { role: null }, error: null };
  });
  return {
    supabase: {
      rpc,
      auth: {
        onAuthStateChange: (cb: Listener) => {
          h.listener = cb;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: async () => ({ data: { session: h.initialSession } }),
        getUser: async () => ({ data: { user: null }, error: null }),
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

/** In-memory localStorage: the test environment's own one is not usable. */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

beforeEach(() => {
  vi.useRealTimers();
  installMemoryStorage();
  h.listener = null;
  h.initialSession = session("u1");
  h.roleAnswers = [];
  h.roleCalls = 0;
  h.gate = null;
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

describe("AuthProvider cached context", () => {
  it("paints at once with this user's cached context and revalidates in the background", async () => {
    writeCachedContext("u1", parseUserContext({ role: "teacher", school_id: "sc1" }));
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    h.roleAnswers = ["teacher"];

    render(<AuthProvider><Probe /></AuthProvider>);
    // Shown before the database answered.
    await screen.findByText("role:teacher");
    expect(h.roleCalls).toBe(1);

    await act(async () => release());
    expect(screen.getByText("role:teacher")).toBeInTheDocument();
  });

  it("uses the fresh answer when the role changed since it was cached", async () => {
    writeCachedContext("u1", parseUserContext({ role: "teacher" }));
    h.roleAnswers = ["school"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("role:school");
  });

  it("ignores another user's cache and clears the cache on sign-out", async () => {
    writeCachedContext("someone-else", parseUserContext({ role: "admin" }));
    h.roleAnswers = ["representative"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("role:representative");
    expect(JSON.parse(window.localStorage.getItem(USER_CONTEXT_STORAGE_KEY)!).userId).toBe("u1");

    await act(async () => h.listener!("SIGNED_OUT", null));
    expect(window.localStorage.getItem(USER_CONTEXT_STORAGE_KEY)).toBeNull();
  });

  it("asks only once when getSession and SIGNED_IN arrive for the same user", async () => {
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    h.roleAnswers = ["school"];
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => h.listener!("SIGNED_IN", session("u1")));
    await act(async () => release());
    await screen.findByText("role:school");
    expect(h.roleCalls).toBe(1);
  });
});
