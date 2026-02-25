import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Save, Upload, RotateCcw, Type, Move, GripHorizontal } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface CarnetLayoutConfig {
  headerHeight: number;
  photoSize: number;
  photoPos: { x: number; y: number };
  namePos: { x: number; y: number };
  badgePos: { x: number; y: number };
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
  fontSizes: { schoolName: 8, studentName: 9, document: 8 },
};

interface CarnetEditorProps {
  primaryColor: string;
  secondaryColor: string;
  schoolName: string;
  logoUrl: string | null;
  watermarkUrl: string | null;
  watermarkOpacity: number;
  watermarkSize: number;
  useCustomWatermark: boolean;
  layout: CarnetLayoutConfig;
  onLayoutChange: (layout: CarnetLayoutConfig) => void;
}

type DragTarget = "photo" | "name" | "badge" | "header-resize" | null;

const CARD_W = 216;
const CARD_H = 342;

export function CarnetEditor({
  primaryColor,
  secondaryColor,
  schoolName,
  logoUrl,
  watermarkUrl,
  watermarkOpacity,
  watermarkSize,
  useCustomWatermark,
  layout,
  onLayoutChange,
}: CarnetEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startVal: { x: 0, y: 0 } });
  const [selectedElement, setSelectedElement] = useState<DragTarget>(null);

  const bodyTop = layout.headerHeight;
  const bodyH = CARD_H - bodyTop - 16; // 16 for bottom bar

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (e: React.PointerEvent, target: DragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(target);
    setSelectedElement(target);

    const rect = getContainerRect();
    if (!rect) return;

    let startVal = { x: 0, y: 0 };
    if (target === "photo") startVal = { ...layout.photoPos };
    else if (target === "name") startVal = { ...layout.namePos };
    else if (target === "badge") startVal = { ...layout.badgePos };
    else if (target === "header-resize") startVal = { x: 0, y: layout.headerHeight };

    setDragStart({ x: e.clientX, y: e.clientY, startVal });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const rect = getContainerRect();
      if (!rect) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      if (dragging === "header-resize") {
        const newH = Math.max(50, Math.min(140, dragStart.startVal.y + dy));
        onLayoutChange({ ...layout, headerHeight: Math.round(newH) });
        return;
      }

      // Convert pixel delta to percentage of body area
      const pctDx = (dx / CARD_W) * 100;
      const pctDy = (dy / bodyH) * 100;

      const newX = Math.max(10, Math.min(90, dragStart.startVal.x + pctDx));
      const newY = Math.max(5, Math.min(90, dragStart.startVal.y + pctDy));
      const pos = { x: Math.round(newX), y: Math.round(newY) };

      if (dragging === "photo") onLayoutChange({ ...layout, photoPos: pos });
      else if (dragging === "name") onLayoutChange({ ...layout, namePos: pos });
      else if (dragging === "badge") onLayoutChange({ ...layout, badgePos: pos });
    },
    [dragging, dragStart, layout, onLayoutChange, bodyH]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const updateFontSize = (key: keyof CarnetLayoutConfig["fontSizes"], val: number) => {
    onLayoutChange({
      ...layout,
      fontSizes: { ...layout.fontSizes, [key]: val },
    });
  };

  const effectiveWatermark = useCustomWatermark && watermarkUrl ? watermarkUrl : logoUrl || "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-4">
        {/* Header height */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GripHorizontal className="h-4 w-4" /> Encabezado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Altura del encabezado: {layout.headerHeight}px</Label>
              <Slider
                value={[layout.headerHeight]}
                onValueChange={(v) => onLayoutChange({ ...layout, headerHeight: v[0] })}
                min={50}
                max={140}
                step={1}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Photo size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Move className="h-4 w-4" /> Foto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Tamaño de foto: {layout.photoSize}px</Label>
              <Slider
                value={[layout.photoSize]}
                onValueChange={(v) => onLayoutChange({ ...layout, photoSize: v[0] })}
                min={30}
                max={90}
                step={1}
                className="mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Arrastra la foto en la vista previa para reubicarla
            </p>
          </CardContent>
        </Card>

        {/* Font sizes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4" /> Tamaños de Fuente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nombre del colegio: {layout.fontSizes.schoolName}px</Label>
              <Slider
                value={[layout.fontSizes.schoolName]}
                onValueChange={(v) => updateFontSize("schoolName", v[0])}
                min={5}
                max={14}
                step={0.5}
                className="mt-2"
              />
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Nombre del estudiante: {layout.fontSizes.studentName}px</Label>
              <Slider
                value={[layout.fontSizes.studentName]}
                onValueChange={(v) => updateFontSize("studentName", v[0])}
                min={6}
                max={16}
                step={0.5}
                className="mt-2"
              />
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Cédula/documento: {layout.fontSizes.document}px</Label>
              <Slider
                value={[layout.fontSizes.document]}
                onValueChange={(v) => updateFontSize("document", v[0])}
                min={5}
                max={14}
                step={0.5}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground px-1">
          💡 Arrastra los elementos en la vista previa para reubicar: foto, nombre y badge.
          Arrastra el borde inferior del encabezado para cambiar su tamaño.
        </p>
      </div>

      {/* Interactive Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Vista Previa Interactiva</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden shadow-lg select-none"
            style={{ width: CARD_W, height: CARD_H, cursor: dragging ? "grabbing" : "default" }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => setSelectedElement(null)}
          >
            {/* Header */}
            <div className="relative" style={{ height: layout.headerHeight, backgroundColor: primaryColor }}>
              <svg className="absolute top-0 left-0" width="40" height={layout.headerHeight * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
                <polygon points={`0,0 40,0 0,${layout.headerHeight * 0.77}`} fill={secondaryColor} />
              </svg>
              <svg className="absolute top-0 right-0" width="40" height={layout.headerHeight * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
                <polygon points={`40,0 0,0 40,${layout.headerHeight * 0.77}`} fill={secondaryColor} style={{ opacity: 0.7 }} />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: secondaryColor }} />
              {logoUrl && (
                <img src={logoUrl} alt="" className="absolute left-1/2 -translate-x-1/2 top-2 h-8 w-8 object-contain" />
              )}
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <p className="text-white font-bold px-4 leading-tight" style={{ fontSize: layout.fontSizes.schoolName }}>
                  {schoolName?.toUpperCase() || "NOMBRE DEL COLEGIO"}
                </p>
                <p className="text-white/80 mt-0.5" style={{ fontSize: 6 }}>Ciudad, Estado</p>
                <p className="text-white/70" style={{ fontSize: 6 }}>Año Escolar: 2024-2025</p>
              </div>

              {/* Header resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center z-20 group"
                onPointerDown={(e) => handlePointerDown(e, "header-resize")}
              >
                <div className="w-8 h-1 rounded-full bg-white/40 group-hover:bg-white/80 transition-colors" />
              </div>
            </div>

            {/* Body */}
            <div className="relative bg-white" style={{ height: bodyH }}>
              {/* Watermark */}
              {effectiveWatermark && (
                <img
                  src={effectiveWatermark}
                  alt=""
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                  style={{
                    width: `${(watermarkSize / 54) * 100}%`,
                    height: `${(watermarkSize / 54) * 100}%`,
                    opacity: watermarkOpacity,
                  }}
                />
              )}

              {/* Draggable Photo */}
              <div
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${
                  selectedElement === "photo" ? "ring-2 ring-blue-500 ring-offset-1" : ""
                }`}
                style={{
                  left: `${layout.photoPos.x}%`,
                  top: `${layout.photoPos.y}%`,
                  cursor: dragging === "photo" ? "grabbing" : "grab",
                }}
                onPointerDown={(e) => handlePointerDown(e, "photo")}
              >
                <div
                  className="rounded-full border-2 bg-muted flex items-center justify-center"
                  style={{ width: layout.photoSize, height: layout.photoSize, borderColor: secondaryColor }}
                >
                  <span className="text-muted-foreground" style={{ fontSize: Math.max(8, layout.photoSize / 6) }}>Foto</span>
                </div>
              </div>

              {/* Draggable Name */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${
                  selectedElement === "name" ? "ring-2 ring-blue-500 ring-offset-1 rounded" : ""
                }`}
                style={{
                  left: `${layout.namePos.x}%`,
                  top: `${layout.namePos.y}%`,
                  cursor: dragging === "name" ? "grabbing" : "grab",
                }}
                onPointerDown={(e) => handlePointerDown(e, "name")}
              >
                <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.studentName }}>
                  NOMBRE DEL ESTUDIANTE
                </p>
              </div>

              {/* Draggable Badge */}
              <div
                className={`absolute -translate-x-1/2 z-10 ${
                  selectedElement === "badge" ? "ring-2 ring-blue-500 ring-offset-1 rounded-full" : ""
                }`}
                style={{
                  left: `${layout.badgePos.x}%`,
                  top: `${layout.badgePos.y}%`,
                  cursor: dragging === "badge" ? "grabbing" : "grab",
                }}
                onPointerDown={(e) => handlePointerDown(e, "badge")}
              >
                <div className="rounded-full px-3 py-0.5" style={{ backgroundColor: secondaryColor }}>
                  <span className="text-white font-bold" style={{ fontSize: 7 }}>ESTUDIANTE</span>
                </div>
              </div>

              {/* Static Document */}
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "74%" }}>
                <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.document }}>
                  V-12345678
                </p>
              </div>

              {/* QR placeholder */}
              <div className="absolute left-1/2 -translate-x-1/2 bg-muted border rounded flex items-center justify-center" style={{ top: "80%", width: 44, height: 44 }}>
                <span className="text-muted-foreground" style={{ fontSize: 7 }}>QR</span>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 h-4 flex">
              <div className="flex-1" style={{ backgroundColor: primaryColor }} />
              <svg width="32" height="16" viewBox="0 0 32 16" className="absolute right-0 bottom-0">
                <polygon points="32,16 0,16 32,0" fill={secondaryColor} />
              </svg>
              <svg width="24" height="16" viewBox="0 0 24 16" className="absolute left-0 bottom-0">
                <polygon points="0,16 24,16 0,0" fill={secondaryColor} style={{ opacity: 0.7 }} />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
