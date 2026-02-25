import { useState, useRef, useCallback } from "react";
import { CarnetLayoutConfig } from "./CarnetEditor";

type DragTarget =
  | "photo" | "name" | "badge" | "doc" | "qr"
  | "schoolName" | "city" | "year" | "logo"
  | "header-resize" | null;

const CARD_W = 280;
const CARD_H = 443;

const HEADER_TARGETS: readonly string[] = ["schoolName", "city", "year", "logo"];

function posKey(target: DragTarget): string {
  const map: Record<string, string> = {
    photo: "photoPos", name: "namePos", badge: "badgePos",
    doc: "docPos", qr: "qrPos", schoolName: "schoolNamePos",
    city: "cityPos", year: "yearPos", logo: "logoPos",
  };
  return target ? map[target] || "" : "";
}

interface CarnetPreviewProps {
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

export function CarnetPreview({
  primaryColor, secondaryColor, schoolName, logoUrl,
  watermarkUrl, watermarkOpacity, watermarkSize, useCustomWatermark,
  layout, onLayoutChange,
}: CarnetPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startVal: { x: 0, y: 0 } });
  const [selectedElement, setSelectedElement] = useState<DragTarget>(null);

  const bodyH = CARD_H - layout.headerHeight - 16;
  const effectiveWatermark = useCustomWatermark && watermarkUrl ? watermarkUrl : logoUrl || "";

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
        const newH = Math.max(50, Math.min(200, dragStart.startVal.y + dy));
        onLayoutChange({ ...layout, headerHeight: Math.round(newH) });
        return;
      }

      const isHeader = HEADER_TARGETS.includes(dragging);
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

  const ring = (t: DragTarget) =>
    selectedElement === t ? "ring-2 ring-blue-500 ring-offset-1" : "";
  const cursor = (t: DragTarget) =>
    dragging === t ? "grabbing" : "grab";

  // Scale factors for preview (original design was 216x342)
  const scale = CARD_W / 216;

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-medium mb-3 text-foreground">Vista Previa Interactiva</p>
      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden shadow-lg select-none"
        style={{ width: CARD_W, height: CARD_H, cursor: dragging ? "grabbing" : "default" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => setSelectedElement(null)}
      >
        {/* HEADER */}
        <div className="relative overflow-hidden" style={{ height: layout.headerHeight * scale, backgroundColor: primaryColor }}>
          <svg className="absolute top-0 left-0" width={40 * scale} height={layout.headerHeight * scale * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
            <polygon points={`0,0 40,0 0,${layout.headerHeight * 0.77}`} fill={secondaryColor} />
          </svg>
          <svg className="absolute top-0 right-0" width={40 * scale} height={layout.headerHeight * scale * 0.77} viewBox={`0 0 40 ${layout.headerHeight * 0.77}`}>
            <polygon points={`40,0 0,0 40,${layout.headerHeight * 0.77}`} fill={secondaryColor} style={{ opacity: 0.7 }} />
          </svg>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 1 * scale, backgroundColor: secondaryColor }} />

          {/* Logo */}
          {logoUrl && (
            <div
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${ring("logo")} rounded`}
              style={{ left: `${layout.logoPos.x}%`, top: `${layout.logoPos.y}%`, cursor: cursor("logo") }}
              onPointerDown={(e) => handlePointerDown(e, "logo")}
            >
              <img src={logoUrl} alt="" className="object-contain pointer-events-none" style={{ width: layout.logoSize * scale, height: layout.logoSize * scale }} />
            </div>
          )}

          {/* School Name */}
          <div
            className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ring("schoolName")} rounded`}
            style={{ left: `${layout.schoolNamePos.x}%`, top: `${layout.schoolNamePos.y}%`, cursor: cursor("schoolName") }}
            onPointerDown={(e) => handlePointerDown(e, "schoolName")}
          >
            <p className="text-white font-bold px-1 leading-tight text-center" style={{ fontSize: layout.fontSizes.schoolName * scale }}>
              {schoolName?.toUpperCase() || "NOMBRE DEL COLEGIO"}
            </p>
          </div>

          {/* City */}
          <div
            className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ring("city")} rounded`}
            style={{ left: `${layout.cityPos.x}%`, top: `${layout.cityPos.y}%`, cursor: cursor("city") }}
            onPointerDown={(e) => handlePointerDown(e, "city")}
          >
            <p className="text-white/80 text-center" style={{ fontSize: 6 * scale }}>Ciudad, Estado</p>
          </div>

          {/* Year */}
          <div
            className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ring("year")} rounded`}
            style={{ left: `${layout.yearPos.x}%`, top: `${layout.yearPos.y}%`, cursor: cursor("year") }}
            onPointerDown={(e) => handlePointerDown(e, "year")}
          >
            <p className="text-white/70 text-center" style={{ fontSize: 6 * scale }}>Año Escolar: 2024-2025</p>
          </div>

          {/* Resize handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center z-20 group"
            onPointerDown={(e) => handlePointerDown(e, "header-resize")}
          >
            <div className="w-12 h-1.5 rounded-full bg-white/30 group-hover:bg-white/70 transition-colors" />
          </div>
        </div>

        {/* BODY */}
        <div className="relative bg-white" style={{ height: CARD_H - layout.headerHeight * scale - 20 }}>
          {effectiveWatermark && (
            <img
              src={effectiveWatermark} alt=""
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
              style={{ width: `${(watermarkSize / 54) * 100}%`, height: `${(watermarkSize / 54) * 100}%`, opacity: watermarkOpacity }}
            />
          )}

          {/* Photo */}
          <div
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${ring("photo")}`}
            style={{ left: `${layout.photoPos.x}%`, top: `${layout.photoPos.y}%`, cursor: cursor("photo") }}
            onPointerDown={(e) => handlePointerDown(e, "photo")}
          >
            <div className="rounded-full border-2 bg-muted flex items-center justify-center" style={{ width: layout.photoSize * scale, height: layout.photoSize * scale, borderColor: secondaryColor }}>
              <span className="text-muted-foreground" style={{ fontSize: Math.max(10, layout.photoSize * scale / 6) }}>Foto</span>
            </div>
          </div>

          {/* Student Name */}
          <div
            className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ring("name")} rounded`}
            style={{ left: `${layout.namePos.x}%`, top: `${layout.namePos.y}%`, cursor: cursor("name") }}
            onPointerDown={(e) => handlePointerDown(e, "name")}
          >
            <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.studentName * scale }}>
              NOMBRE DEL ESTUDIANTE
            </p>
          </div>

          {/* Badge */}
          <div
            className={`absolute -translate-x-1/2 z-10 ${ring("badge")} rounded-full`}
            style={{ left: `${layout.badgePos.x}%`, top: `${layout.badgePos.y}%`, cursor: cursor("badge") }}
            onPointerDown={(e) => handlePointerDown(e, "badge")}
          >
            <div className="rounded-full px-4 py-0.5" style={{ backgroundColor: secondaryColor }}>
              <span className="text-white font-bold" style={{ fontSize: 8 * scale }}>ESTUDIANTE</span>
            </div>
          </div>

          {/* Document */}
          <div
            className={`absolute -translate-x-1/2 z-10 whitespace-nowrap ${ring("doc")} rounded`}
            style={{ left: `${layout.docPos.x}%`, top: `${layout.docPos.y}%`, cursor: cursor("doc") }}
            onPointerDown={(e) => handlePointerDown(e, "doc")}
          >
            <p className="font-bold text-center" style={{ color: primaryColor, fontSize: layout.fontSizes.document * scale }}>
              V-12345678
            </p>
          </div>

          {/* QR */}
          <div
            className={`absolute -translate-x-1/2 z-10 ${ring("qr")} rounded`}
            style={{ left: `${layout.qrPos.x}%`, top: `${layout.qrPos.y}%`, cursor: cursor("qr") }}
            onPointerDown={(e) => handlePointerDown(e, "qr")}
          >
            <div className="bg-muted border rounded flex items-center justify-center" style={{ width: layout.qrSize * scale, height: layout.qrSize * scale }}>
              <span className="text-muted-foreground" style={{ fontSize: 8 * scale }}>QR</span>
            </div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: 20 }}>
          <div className="flex-1" style={{ backgroundColor: primaryColor }} />
          <svg width={40} height={20} viewBox="0 0 32 16" className="absolute right-0 bottom-0">
            <polygon points="32,16 0,16 32,0" fill={secondaryColor} />
          </svg>
          <svg width={30} height={20} viewBox="0 0 24 16" className="absolute left-0 bottom-0">
            <polygon points="0,16 24,16 0,0" fill={secondaryColor} style={{ opacity: 0.7 }} />
          </svg>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center max-w-[280px]">
        💡 Arrastra cualquier elemento para reubicarlo. Usa los controles de la izquierda para ajustar tamaños.
      </p>
    </div>
  );
}
