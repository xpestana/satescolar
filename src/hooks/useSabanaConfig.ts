import { useState, useEffect, useRef } from "react";

export interface SabanaDisplayConfig {
  headerColor: string;    // hex, e.g. "#2980B9"
  marginX: number;        // mm, horizontal margin
  marginY: number;        // mm, top margin for content start
  tableFontSize: number;  // pt, table body rows
  headerFontSize: number; // pt, table header row
}

export const DEFAULT_SABANA_CONFIG: SabanaDisplayConfig = {
  headerColor: "#2980B9",
  marginX: 10,
  marginY: 12,
  tableFontSize: 10,
  headerFontSize: 10,
};

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

interface UseSabanaConfigOptions {
  /** DB value to initialize from once loaded */
  initialConfig?: SabanaDisplayConfig;
  /** Called with debounce after every user change */
  onSave?: (config: SabanaDisplayConfig) => void;
}

export function useSabanaConfig({ initialConfig, onSave }: UseSabanaConfigOptions = {}) {
  const [config, setConfig] = useState<SabanaDisplayConfig>(DEFAULT_SABANA_CONFIG);

  // Avoid re-initializing once the user has made changes
  const hasUserChanged = useRef(false);
  // Keep latest onSave ref to avoid stale closures
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  // Timer for debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // One-time init from DB (ignored if user already changed something)
  useEffect(() => {
    if (initialConfig && !hasUserChanged.current) {
      const hasValues = Object.keys(initialConfig).length > 0;
      if (hasValues) setConfig(initialConfig);
    }
  }, [initialConfig]);

  function scheduleSave(next: SabanaDisplayConfig) {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => onSaveRef.current?.(next), 600);
  }

  function updateConfig(partial: Partial<SabanaDisplayConfig>) {
    hasUserChanged.current = true;
    setConfig(prev => {
      const next = { ...prev, ...partial };
      scheduleSave(next);
      return next;
    });
  }

  function resetConfig() {
    hasUserChanged.current = true;
    clearTimeout(saveTimerRef.current);
    setConfig(DEFAULT_SABANA_CONFIG);
    onSaveRef.current?.(DEFAULT_SABANA_CONFIG);
  }

  return { config, updateConfig, resetConfig };
}
