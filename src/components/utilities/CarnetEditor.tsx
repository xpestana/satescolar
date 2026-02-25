// Types and defaults for carnet layout configuration
export interface CarnetLayoutConfig {
  headerHeight: number;
  photoSize: number;
  photoPos: { x: number; y: number };
  namePos: { x: number; y: number };
  badgePos: { x: number; y: number };
  docPos: { x: number; y: number };
  qrPos: { x: number; y: number };
  qrSize: number;
  schoolNamePos: { x: number; y: number };
  cityPos: { x: number; y: number };
  yearPos: { x: number; y: number };
  logoPos: { x: number; y: number };
  logoSize: number;
  fontSizes: {
    schoolName: number;
    studentName: number;
    document: number;
  };
}

export const DEFAULT_LAYOUT: CarnetLayoutConfig = {
  headerHeight: 88,
  photoSize: 56,
  photoPos: { x: 50, y: 15 },
  namePos: { x: 50, y: 52 },
  badgePos: { x: 50, y: 62 },
  docPos: { x: 50, y: 74 },
  qrPos: { x: 50, y: 85 },
  qrSize: 44,
  schoolNamePos: { x: 50, y: 55 },
  cityPos: { x: 50, y: 72 },
  yearPos: { x: 50, y: 85 },
  logoPos: { x: 50, y: 20 },
  logoSize: 32,
  fontSizes: { schoolName: 8, studentName: 9, document: 8 },
};
