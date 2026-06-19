import { useState } from "react";

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

export function useSabanaConfig() {
  const [config, setConfig] = useState<SabanaDisplayConfig>(DEFAULT_SABANA_CONFIG);

  function updateConfig(partial: Partial<SabanaDisplayConfig>) {
    setConfig(prev => ({ ...prev, ...partial }));
  }

  function resetConfig() {
    setConfig(DEFAULT_SABANA_CONFIG);
  }

  return { config, updateConfig, resetConfig };
}
