import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  hovering: boolean;
  toggleCollapsed: () => void;
  setHovering: (v: boolean) => void;
  isVisible: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  hovering: false,
  toggleCollapsed: () => {},
  setHovering: () => {},
  isVisible: true,
});

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
    setHovering(false);
  }, []);

  const isVisible = !collapsed || hovering;

  return (
    <SidebarContext.Provider value={{ collapsed, hovering, toggleCollapsed, setHovering, isVisible }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  return useContext(SidebarContext);
}
