import { useRef, useState, useCallback } from "react";
import { OVERLAY_FIELDS, OverlayField } from "@/pages/school/InvoiceTemplateConfig";

const CANVAS_W = 560; // px display width

const SAMPLE: Record<string, string> = {
  invoice_number:      "016725",
  date_day:            "11",
  date_month:          "05",
  date_year:           "2026",
  titular_nombre:      "María González",
  titular_ci:          "V-15.234.567",
  student_name:        "Ana González",
  student_grade:       "3er Año",
  student_section:     "A",
  concepts_all:        "Mensualidad Sep. / Seguro Escolar / Comunidad Educ.",
  concept_1_name:      "Mensualidad Septiembre",
  concept_1_amount:    "5.000,00",
  concept_2_name:      "Comunidad Educativa",
  concept_2_amount:    "1.200,00",
  concept_3_name:      "Seguro Escolar",
  concept_3_amount:    "800,00",
  concept_4_name:      "Deuda Anterior",
  concept_4_amount:    "500,00",
  concept_5_name:      "Pre Inscripción",
  concept_5_amount:    "300,00",
  concept_6_name:      "Actividades Extra",
  concept_6_amount:    "200,00",
  concept_7_name:      "",
  concept_7_amount:    "",
  concept_8_name:      "",
  concept_8_amount:    "",
  concept_9_name:      "",
  concept_9_amount:    "",
  concept_10_name:     "",
  concept_10_amount:   "",
  total_amount:        "8.000,00",
  payment_method_text: "Transferencia Bancaria",
};

const GROUP_LABELS: Record<string, string> = {
  header:   "Encabezado",
  titular:  "Titular / Facturado a",
  student:  "Estudiante",
  concepts: "Conceptos",
  totals:   "Totales",
};

interface DragState {
  key: string;
  type: "move" | "resize";
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
}

interface Props {
  fields: OverlayField[];
  onChange: (fields: OverlayField[]) => void;
  paperWidthMm: number;
  paperHeightMm: number;
  backgroundUrl?: string;
}

export function InvoiceCanvasEditor({ fields, onChange, paperWidthMm, paperHeightMm, backgroundUrl }: Props) {
  const scale  = CANVAS_W / paperWidthMm;
  const canvasH = Math.round(paperHeightMm * scale);

  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const getField  = (key: string) => fields.find((f) => f.key === key);
  const isActive  = (key: string) => !!getField(key);

  const updateField = useCallback(
    (key: string, updates: Partial<OverlayField>) => {
      onChange(fields.map((f) => (f.key === key ? { ...f, ...updates } : f)));
    },
    [fields, onChange],
  );

  const toggleField = (key: string) => {
    if (isActive(key)) {
      onChange(fields.filter((f) => f.key !== key));
      if (selected === key) setSelected(null);
    } else {
      const idx = OVERLAY_FIELDS.findIndex((f) => f.key === key);
      const newField: OverlayField = {
        key,
        x_mm:         20,
        y_mm:         Math.min(20 + idx * 7, paperHeightMm - 10),
        font_size_pt: 9,
        width_mm:     80,
      };
      onChange([...fields, newField]);
      setSelected(key);
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      if (d.type === "move") {
        updateField(d.key, {
          x_mm: Math.max(0, Math.round((d.origX + dx) * 2) / 2),
          y_mm: Math.max(0, Math.round((d.origY + dy) * 2) / 2),
        });
      } else {
        updateField(d.key, {
          width_mm: Math.max(10, Math.round((d.origW + dx) * 2) / 2),
        });
      }
    },
    [scale, updateField],
  );

  const handleMouseUp = () => { dragRef.current = null; };

  const startDrag = (e: React.MouseEvent, key: string, type: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(key);
    const f = getField(key)!;
    dragRef.current = { key, type, startX: e.clientX, startY: e.clientY, origX: f.x_mm, origY: f.y_mm, origW: f.width_mm };
  };

  const selectedField = selected ? getField(selected) : null;
  const selectedMeta  = selected ? OVERLAY_FIELDS.find((f) => f.key === selected) : null;

  // Group fields for the left panel
  const groups = Array.from(new Set(OVERLAY_FIELDS.map((f) => f.group)));

  return (
    <div className="flex gap-3 min-h-0" style={{ height: "62vh" }}>

      {/* ── Left panel: grouped field list ─────────────────────────────── */}
      <div className="flex flex-col overflow-y-auto border rounded-md" style={{ width: 230, flexShrink: 0 }}>

        {/* Selected field controls (sticky) */}
        {selectedField && selectedMeta && (
          <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-200 p-2">
            <p className="text-[11px] font-semibold text-blue-700 mb-2 truncate">{selectedMeta.label}</p>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-[11px] text-muted-foreground whitespace-nowrap">Fuente pt</label>
              <input
                type="number"
                value={selectedField.font_size_pt}
                min={6} max={24} step={0.5}
                onChange={(e) => updateField(selected!, { font_size_pt: parseFloat(e.target.value) || 9 })}
                className="w-14 text-xs border border-slate-300 rounded px-1 py-0.5"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer mb-1.5">
              <input
                type="checkbox"
                checked={selectedField.bold ?? false}
                onChange={(e) => updateField(selected!, { bold: e.target.checked })}
              />
              Negrita
            </label>
            <p className="text-[10px] text-slate-400 font-mono">
              x:{selectedField.x_mm} y:{selectedField.y_mm} w:{selectedField.width_mm}
            </p>
          </div>
        )}

        {/* Field groups */}
        <div className="p-1.5">
          {groups.map((group) => {
            const groupFields = OVERLAY_FIELDS.filter((f) => f.group === group);
            const anyActive   = groupFields.some((f) => isActive(f.key));
            return (
              <div key={group} className="mb-2">
                <p className={`text-[10px] font-semibold uppercase tracking-wide px-1 mb-1
                  ${anyActive ? "text-blue-600" : "text-slate-400"}`}>
                  {GROUP_LABELS[group] ?? group}
                </p>
                <div className="space-y-0.5">
                  {groupFields.map((f) => {
                    const active = isActive(f.key);
                    const isSel  = selected === f.key;
                    return (
                      <div
                        key={f.key}
                        onClick={() => { if (active) setSelected(isSel ? null : f.key); }}
                        className={`flex items-start gap-1.5 px-1.5 py-1 rounded cursor-pointer select-none
                          ${isSel   ? "bg-blue-100"
                          : active  ? "bg-slate-50 hover:bg-slate-100"
                          :           "hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleField(f.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 flex-shrink-0 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className={`text-[11px] leading-tight
                            ${isSel  ? "text-blue-700 font-semibold"
                            : active ? "font-medium text-slate-700"
                            :          "text-slate-500"}`}>
                            {f.label}
                          </p>
                          {f.example && (
                            <p className="text-[10px] text-slate-400 truncate">{f.example}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel: canvas ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-w-0">
        <p className="text-[11px] text-muted-foreground mb-1.5">
          Arrastra para mover · Borde derecho azul para cambiar ancho · Clic en un campo para editar fuente
        </p>

        <div
          style={{
            position: "relative",
            width:    CANVAS_W,
            height:   canvasH,
            background: "white",
            border: "1px solid #cbd5e1",
            cursor: "default",
            flexShrink: 0,
            userSelect: "none",
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelected(null)}
        >
          {/* Background scan */}
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt=""
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }}
            />
          )}

          {/* Grid lines every 10 mm */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {Array.from({ length: Math.floor(paperWidthMm  / 10) - 1 }).map((_, i) => (
              <line key={`v${i}`} x1={(i+1)*10*scale} y1={0}       x2={(i+1)*10*scale} y2={canvasH}  stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {Array.from({ length: Math.floor(paperHeightMm / 10) - 1 }).map((_, i) => (
              <line key={`h${i}`} x1={0}              y1={(i+1)*10*scale} x2={CANVAS_W} y2={(i+1)*10*scale} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {/* Ruler labels */}
            {Array.from({ length: Math.floor(paperWidthMm / 10) }).map((_, i) => (
              <text key={`rl${i}`} x={(i+1)*10*scale - 6} y={8} fontSize={6} fill="#cbd5e1" fontFamily="monospace">
                {(i+1)*10}
              </text>
            ))}
          </svg>

          {/* Field boxes */}
          {fields.map((f) => {
            const meta    = OVERLAY_FIELDS.find((m) => m.key === f.key);
            const isSel   = selected === f.key;
            const sample  = SAMPLE[f.key] || meta?.example || f.key;
            // pt → canvas px: 1pt = 25.4/72 mm, then × scale px/mm
            const fontPx  = Math.max(7, (f.font_size_pt * 25.4) / 72 * scale);

            return (
              <div
                key={f.key}
                style={{
                  position:   "absolute",
                  left:       f.x_mm     * scale,
                  top:        f.y_mm     * scale,
                  width:      f.width_mm * scale,
                  minHeight:  fontPx + 10,
                  cursor:     "move",
                  border:     isSel ? "1.5px solid #2563eb" : "1px dashed #94a3b8",
                  background: isSel ? "rgba(219,234,254,0.6)" : "rgba(248,250,252,0.55)",
                  boxSizing:  "border-box",
                  overflow:   "hidden",
                }}
                onMouseDown={(e) => startDrag(e, f.key, "move")}
                onClick={(e) => { e.stopPropagation(); setSelected(f.key); }}
              >
                {/* Tiny field label */}
                <div style={{ fontSize: 7, color: isSel ? "#1d4ed8" : "#94a3b8", lineHeight: 1, paddingLeft: 2, paddingTop: 1, fontFamily: "sans-serif", whiteSpace: "nowrap" }}>
                  {meta?.label ?? f.key}
                </div>

                {/* Sample value */}
                <div style={{ fontSize: fontPx, fontWeight: f.bold ? "bold" : "normal", fontFamily: "Arial, Helvetica, sans-serif", color: "#0f172a", lineHeight: 1.1, paddingLeft: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {sample}
                </div>

                {/* Resize handle */}
                {isSel && (
                  <div
                    style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 7, background: "#2563eb", cursor: "ew-resize", opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}
                    onMouseDown={(e) => startDrag(e, f.key, "resize")}
                  >
                    <div style={{ width: 1, height: "60%", background: "white", opacity: 0.7 }} />
                    <div style={{ width: 1, height: "60%", background: "white", opacity: 0.7 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Activa campos en el panel izquierdo para colocarlos sobre el papel.
          </p>
        )}
      </div>
    </div>
  );
}
