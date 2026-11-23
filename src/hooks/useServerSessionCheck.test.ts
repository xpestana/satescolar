import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { verifyServerSession } = vi.hoisted(() => ({ verifyServerSession: vi.fn() }));
vi.mock("@/lib/sessionGuard", () => ({ verifyServerSession }));

import { SESSION_CHECK_INTERVAL_MS, useServerSessionCheck } from "./useServerSessionCheck";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useServerSessionCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    verifyServerSession.mockReset().mockResolvedValue("valid");
  });
  afterEach(() => vi.useRealTimers());

  it("does nothing without a signed-in user", () => {
    renderHook(() => useServerSessionCheck(null));
    expect(verifyServerSession).not.toHaveBeenCalled();
  });

  it("checks once when a user is present", () => {
    renderHook(() => useServerSessionCheck("u1"));
    expect(verifyServerSession).toHaveBeenCalledTimes(1);
  });

  it("checks again when the tab comes back after the interval, not before", () => {
    renderHook(() => useServerSessionCheck("u1"));
    setVisibility("visible");
    expect(verifyServerSession).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS + 1);
    setVisibility("hidden");
    expect(verifyServerSession).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(verifyServerSession).toHaveBeenCalledTimes(2);
  });

  it("stops listening after unmount", () => {
    const { unmount } = renderHook(() => useServerSessionCheck("u1"));
    unmount();
    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS + 1);
    setVisibility("visible");
    expect(verifyServerSession).toHaveBeenCalledTimes(1);
  });
});
