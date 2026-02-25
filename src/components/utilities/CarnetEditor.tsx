import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GripHorizontal, Move, Type } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface CarnetLayoutConfig {
  headerHeight: number;
  photoSize: number;
  photoPos: { x: number; y: number };
  namePos: { x: number; y: number };
  badgePos: { x: number; y: number };
  docPos: { x: number; y: number };
  qrPos: { x: number; y: number };
  // Header element positions (percentage within header area)
  schoolNamePos: { x: number; y: number };
  cityPos: { x: number; y: number };
  yearPos: { x: number; y: number };
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
  schoolNamePos: { x: 50, y: 55 },
  cityPos: { x: 50, y: 72 },
  yearPos: { x: 50, y: 85 },
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

type DragTarget =
  | "photo" | "name" | "badge" | "doc" | "qr"
  | "schoolName" | "city" | "year"
  | "header-resize" | null;

const CARD_W = 216;
const CARD_H = 342;

// Map drag targets to layout keys for body elements
const BODY_TARGETS = ["photo", "name", "badge", "doc", "qr"] as const;
const HEADER_TARGETS = ["schoolName", "city", "year"] as const;

function posKey(target: DragTarget): string {
  if (target === "photo") return "photoPos";
  if (target === "name") return "namePos";
  if (target === "badge") return "badgePos";
  if (target === "doc") return "docPos";
  if (target === "qr") return "qrPos";
  if (target === "schoolName") return "schoolNamePos";
  if (target === "city") return "cityPos";
  if (target === "year") return "yearPos";
  return "";
}

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

  const bodyH = CARD_H - layout.headerHeight - 16;

  const handlePointerDown = (e: React.PointerEvent, target: DragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(target);
    setSelectedElement(target);

    let startVal = { x: 0, y: 0 };
    if (target === "header-resize") {
      startVal = { x: 0, y: layout.headerHeight };
    } else {
      const key = posKey(target);
      if (key) startVal = { ...(layout as any)[key] };
    }

    setDragStart({ x: e.clientX, y: e.clientY, startVal });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      if (dragging === "header-resize") {
        const newH = Math.max(50, Math.min(160, dragStart.startVal.y + dy));
        onLayoutChange({ ...layout, headerHeight: Math.round(newH) });
        return;
      }

      const isHeader = (HEADER_TARGETS as readonly string[]).includes(dragging);
      const areaH = isHeader ? layout.headerHeight : bodyH;

      const pctDx = (dx / CARD_W) * 100;
      const pctDy = (dy / areaH) * 100;

      const newX = Math.max(5, Math.min(95, dragStart.startVal.x + pctDx));
      const newY = Math.max(5, Math.min(95, dragStart.startVal.y + pctDy));
      const pos = { x: Math.round(newX), y: Math.round(newY) };

      const key = posKey(dragging);
      if (key) onLayoutChange({ ...layout, [key]: pos });
    },
    [dragging, dragStart, layout, onLayoutChange, bodyH]
  );

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const updateFontSize = (key: keyof CarnetLayoutConfig["fontSizes"], val: number) => {
    onLayoutChange({ ...layout, fontSizes: { ...layout.fontSizes, [key]: val } });
  };

  const effectiveWatermark = useCustomWatermark && watermarkUrl ? watermarkUrl : logoUrl || "";

  const ringClass = (target: DragTarget) =>
    selectedElement === target ? "ring-2 ring-blue-500 ring-offset-1" : "";

  const cursorStyle = (target: DragTarget) =>
    dragging === target ? "grabbing" : "grab";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GripHorizontal className="h-4 w-4" /> Encabezado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-xs">Altura: {layout.headerHeight}px</Label>
            <Slider
              value={[layout.headerHeight]}
              onValueChange={(v) => onLayoutChange({ ...layout, headerHeight: v[0] })}
              min={50}
              max={160}
              step={1}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Move className="h-4 w-4" /> Foto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-xs">Tamaño: {layout.photoSize}px</Label>
            <Slider
              value={[layout.photoSize]}
              onValueChange={(v) => onLayoutChange({ ...layout, photoSize: v[0] })}
              min={30}
              max={90}
              step={1}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4" /> Tamaños de Fuente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nombre del colegio: {layout.fontSizes.schoolName}px</Label>
              <Slider value={[layout.fontSizes.schoolName]} onValueChange={(v) => updateFontSize("schoolName", v[0])} min={5} max={14} step={0.5} className="mt-2" />
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Nombre del estudiante: {layout.fontSizes.studentName}px</Label>
              <Slider value={[layout.fontSizes.studentName]} onValueChange={(v) => updateFontSize("studentName", v[0])} min={6} max={16} step={0.5} className="mt-2" />
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Cédula/documento: {layout.fontSizes.document}px</Label>
              <Slider value={[layout.fontSizes.document]} onValueChange={(v) => updateFontSize("document", v[0])} min={5} max={14} step={0.5} className="mt-2" />
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground px-1">
          💡 Arrastra cualquier texto o elemento en la vista previa para reubicarlo. Usa los sliders para ajustar tamaños.
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
            {/* ===== HEADER ===== */}
            <div className="relative overflow-hidden" style={{ height: layout.headerHeight, backgroundColor: primaryColor }}>
              {/* Decorative triangles */}
              <svg className="absolute top-0 left-0" width="40" height={layout.headerHeight * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
                <polygon points={`0,0 40,0 0,${layout.headerHeight * 0.77}`} fill={secondaryColor} />
              </svg>
              <svg className="absolute top-0 right-0" width="40" height={layout.headerHeight * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
                <polygon points={`40,0 0,0 40,${layout.headerHeight * 0.77}`} fill={secondaryColor} style={{ opacity: 0.7 }} />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: secondaryColor }} />

              {/* Logo - static, centered top */}
              {logoUrl && (
                <img src={logoUrl} alt="" className="absolute left-1/2 -translate-x-1/2 top-2 h-8 w-8 object-contain pointer-events-none" />
              )}

              {/* Draggable: School Name */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ringClass("schoolName")} rounded`}
                style={{ left: `${layout.schoolNamePos.x}%`, top: `${layout.schoolNamePos.y}%`, cursor: cursorStyle("schoolName") }}
                onPointerDown={(e) => handlePointerDown(e, "schoolName")}
              >
                <p className="text-white font-bold px-1 leading-tight text-center" style={{ fontSize: layout.fontSizes.schoolName }}>
                  {schoolName?.toUpperCase() || "NOMBRE DEL COLEGIO"}
                </p>
              </div>

              {/* Draggable: City */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ringClass("city")} rounded`}
                style={{ left: `${layout.cityPos.x}%`, top: `${layout.cityPos.y}%`, cursor: cursorStyle("city") }}
                onPointerDown={(e) => handlePointerDown(e, "city")}
              >
                <p className="text-white/80 text-center" style={{ fontSize: 6 }}>Ciudad, Estado</p>
              </div>

              {/* Draggable: Year */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ringClass("year")} rounded`}
                style={{ left: `${layout.yearPos.x}%`, top: `${layout.yearPos.y}%`, cursor: cursorStyle("year") }}
                onPointerDown={(e) => handlePointerDown(e, "year")}
              >
                <p className="text-white/70 text-center" style={{ fontSize: 6 }}>Año Escolar: 2024-2025</p>
              </div>

              {/* Header resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center z-20 group"
                onPointerDown={(e) => handlePointerDown(e, "header-resize")}
              >
                <div className="w-10 h-1.5 rounded-full bg-white/30 group-hover:bg-white/70 transition-colors" />
              </div>
            </div>

            {/* ===== BODY ===== */}
            <div className="relative bg-white" style={{ height: bodyH }}>
              {/* Watermark */}
              {effectiveWatermark && (
                <img
                  src={effectiveWatermark}
                  alt=""
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                  style={{ width: `${(watermarkSize / 54) * 100}%`, height: `${(watermarkSize / 54) * 100}%`, opacity: watermarkOpacity }}
                />
              )}

              {/* Draggable: Photo */}
              <div
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${ringClass("photo")}`}
                style={{ left: `${layout.photoPos.x}%`, top: `${layout.photoPos.y}%`, cursor: cursorStyle("photo") }}
                onPointerDown={(e) => handlePointerDown(e, "photo")}
              >
                <div className="rounded-full border-2 bg-muted flex items-center justify-center" style={{ width: layout.photoSize, height: layout.photoSize, borderColor: secondaryColor }}>
                  <span className="text-muted-foreground" style={{ fontSize: Math.max(8, layout.photoSize / 6) }}>Foto</span>
                </div>
              </div>

              {/* Draggable: Student Name */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ringClass("name")} rounded`}
                style={{ left: `${layout.namePos.x}%`, top: `${layout.namePos.y}%`, cursor: cursorStyle("name") }}
                onPointerDown={(e) => handlePointerDown(e, "name")}
              >
                <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.studentName }}>
                  NOMBRE DEL ESTUDIANTE
                </p>
              </div>

              {/* Draggable: Badge/Rol */}
              <div
                className={`absolute -translate-x-1/2 z-10 ${ringClass("badge")} rounded-full`}
                style={{ left: `${layout.badgePos.x}%`, top: `${layout.badgePos.y}%`, cursor: cursorStyle("badge") }}
                onPointerDown={(e) => handlePointerDown(e, "badge")}
              >
                <div className="rounded-full px-3 py-0.5" style={{ backgroundColor: secondaryColor }}>
                  <span className="text-white font-bold" style={{ fontSize: 7 }}>ESTUDIANTE</span>
                </div>
              </div>

              {/* Draggable: Document/Cédula */}
              <div
                className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ringClass("doc")} rounded`}
                style={{ left: `${layout.docPos.x}%`, top: `${layout.docPos.y}%`, cursor: cursorStyle("doc") }}
                onPointerDown={(e) => handlePointerDown(e, "doc")}
              >
                <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.document }}>
                  V-12345678
                </p>
              </div>

              {/* Draggable: QR */}
              <div
                className={`absolute -translate-x-1/2 z-10 ${ringClass("qr")} rounded`}
                style={{ left: `${layout.qrPos.x}%`, top: `${layout.qrPos.y}%`, cursor: cursorStyle("qr") }}
                onPointerDown={(e) => handlePointerDown(e, "qr")}
              >
                <div className="bg-muted border rounded flex items-center justify-center" style={{ width: 44, height: 44 }}>
                  <span className="text-muted-foreground" style={{ fontSize: 7 }}>QR</span>
                </div>
              </div>
            </div>

            {/* ===== BOTTOM BAR ===== */}
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
