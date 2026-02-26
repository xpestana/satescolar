import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  hovering: boolean;
  toggleCollapsed: () => void;
  setHovering: (v: boolean) => void;
  /** Whether sidebar is effectively visible (pinned open OR hovered) */
  isVisible: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  hovering: false,
  toggleCollapsed: () => {},
  setHovering: () => {},
  isVisible: true,
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

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
