import { useRef, useState, useCallback } from "react";
import { OVERLAY_FIELDS, OverlayField } from "@/pages/school/InvoiceTemplateConfig";

const CANVAS_W = 560; // px display width

/** Sample values for the static (non-concept) fields */
const STATIC_SAMPLE: Record<string, string> = {
  invoice_number:      "016725",
  control_number:      "00-00016725",
  date_day:            "11",
  date_month:          "05",
  date_year:           "2026",
  titular_nombre:      "María González",
  titular_ci:          "V-15.234.567",
  student_name:        "Ana González / Luis González",
  student_grade:       "3er Año",
  student_section:     "A",
  // Un bloque por hijo, para facturas familiares
  student_name_1:      "Ana González",
  student_grade_1:     "3er Año",
  student_section_1:   "A",
  student_name_2:      "Luis González",
  student_grade_2:     "1er Año",
  student_section_2:   "B",
  student_name_3:      "Sofía González",
  student_grade_3:     "6to Grado",
  student_section_3:   "U",
  student_name_4:      "Pedro González",
  student_grade_4:     "2do Grado",
  student_section_4:   "A",
  concepts_all:        "Mensualidad Sep. / Seguro Escolar",
  total_amount:        "8.000,00",
  total_discount:      "2.500,00",
  discount_reason:     "Ingresó a mitad de mes",
  payment_method_text: "Transferencia Bancaria",
};

const GROUP_LABELS: Record<string, string> = {
  header:   "Encabezado",
  titular:  "Titular / Facturado a",
  student:  "Estudiante",
  concepts: "General",
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
  /** Real payment concepts from the school DB */
  schoolConcepts: { id: string; name: string }[];
}

export function InvoiceCanvasEditor({
  fields, onChange, paperWidthMm, paperHeightMm, backgroundUrl, schoolConcepts,
}: Props) {
  const scale   = CANVAS_W / paperWidthMm;
  const canvasH = Math.round(paperHeightMm * scale);

  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const getField = (key: string) => fields.find((f) => f.key === key);
  const isActive = (key: string) => !!getField(key);

  const updateField = useCallback(
    (key: string, updates: Partial<OverlayField>) => {
      onChange(fields.map((f) => (f.key === key ? { ...f, ...updates } : f)));
    },
    [fields, onChange],
  );

  const toggleStaticField = (key: string) => {
    if (isActive(key)) {
      onChange(fields.filter((f) => f.key !== key));
      if (selected === key) setSelected(null);
    } else {
      const idx = OVERLAY_FIELDS.findIndex((f) => f.key === key);
      onChange([...fields, { key, x_mm: 20, y_mm: Math.min(20 + idx * 7, paperHeightMm - 10), font_size_pt: 9, width_mm: 80 }]);
      setSelected(key);
    }
  };

  const toggleConceptField = (concept: { id: string; name: string }) => {
    const key = `concept:${concept.id}`;
    if (isActive(key)) {
      onChange(fields.filter((f) => f.key !== key));
      if (selected === key) setSelected(null);
    } else {
      const idx = schoolConcepts.findIndex((c) => c.id === concept.id);
      onChange([
        ...fields,
        {
          key,
          label:        concept.name,
          x_mm:         20,
          y_mm:         Math.min(80 + idx * 9, paperHeightMm - 10),
          font_size_pt: 10,
          width_mm:     15,          // narrow — just for a checkmark "✓"
        },
      ]);
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
          width_mm: Math.max(5, Math.round((d.origW + dx) * 2) / 2),
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

  /** Resolve display label for any field key */
  const resolveLabel = (key: string): string => {
    if (key.startsWith("concept:")) {
      const id = key.replace("concept:", "");
      return schoolConcepts.find((c) => c.id === id)?.name ?? key;
    }
    return OVERLAY_FIELDS.find((f) => f.key === key)?.label ?? key;
  };

  /** Resolve sample/preview value for any field key */
  const resolveSample = (key: string): string => {
    // all concepts show as paid in the preview: amount if configured, "✓" otherwise
    if (key.startsWith("concept:")) return getField(key)?.show_amount ? "5.000,00" : "✓";
    return STATIC_SAMPLE[key] ?? OVERLAY_FIELDS.find((f) => f.key === key)?.example ?? key;
  };

  /** Concept fields print either a "✓" or the amount paid — a check needs far less width */
  const setShowAmount = (key: string, showAmount: boolean) => {
    const f = getField(key);
    if (!f) return;
    updateField(key, {
      show_amount: showAmount,
      width_mm: showAmount ? Math.max(f.width_mm, 25) : f.width_mm,
    });
  };

  /** Same switch applied to every concept field at once (single state update) */
  const setShowAmountAll = (showAmount: boolean) => {
    onChange(fields.map((f) => (
      f.key.startsWith("concept:")
        ? { ...f, show_amount: showAmount, width_mm: showAmount ? Math.max(f.width_mm, 25) : f.width_mm }
        : f
    )));
  };

  const conceptFields    = fields.filter((f) => f.key.startsWith("concept:"));
  const allConceptAmount = conceptFields.length > 0 && conceptFields.every((f) => f.show_amount);

  const selectedField = selected ? getField(selected) : null;
  const selectedLabel = selected ? resolveLabel(selected) : null;

  // Group static fields (exclude the "concepts" group entry — it renders separately)
  const staticGroups = Array.from(new Set(OVERLAY_FIELDS.map((f) => f.group)));

  return (
    <div className="flex gap-3 min-h-0" style={{ height: "62vh" }}>

      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="flex flex-col overflow-y-auto border rounded-md" style={{ width: 230, flexShrink: 0 }}>

        {/* Selected field controls */}
        {selectedField && (
          <div className="sticky top-0 z-10 bg-blue-50 border-b border-blue-200 p-2">
            <p className="text-[11px] font-semibold text-blue-700 mb-2 truncate">{selectedLabel}</p>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-[11px] text-muted-foreground whitespace-nowrap">Fuente pt</label>
              <input
                type="number" value={selectedField.font_size_pt} min={6} max={24} step={0.5}
                onChange={(e) => updateField(selected!, { font_size_pt: parseFloat(e.target.value) || 9 })}
                className="w-14 text-xs border border-slate-300 rounded px-1 py-0.5"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer mb-1.5">
              <input type="checkbox" checked={selectedField.bold ?? false}
                onChange={(e) => updateField(selected!, { bold: e.target.checked })} />
              Negrita
            </label>
            {selected!.startsWith("concept:") && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer mb-1.5">
                <input type="checkbox" checked={selectedField.show_amount ?? false}
                  onChange={(e) => setShowAmount(selected!, e.target.checked)} />
                Imprimir monto (en vez de ✓)
              </label>
            )}
            <p className="text-[10px] text-slate-400 font-mono">
              x:{selectedField.x_mm} y:{selectedField.y_mm} w:{selectedField.width_mm}
            </p>
          </div>
        )}

        <div className="p-1.5 space-y-3">
          {/* Static field groups */}
          {staticGroups.map((group) => {
            const groupFields = OVERLAY_FIELDS.filter((f) => f.group === group);
            const anyActive   = groupFields.some((f) => isActive(f.key));
            return (
              <div key={group}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide px-1 mb-1
                  ${anyActive ? "text-blue-600" : "text-slate-400"}`}>
                  {GROUP_LABELS[group] ?? group}
                </p>
                <div className="space-y-0.5">
                  {groupFields.map((f) => {
                    const active = isActive(f.key);
                    const isSel  = selected === f.key;
                    return (
                      <div key={f.key}
                        onClick={() => { if (active) setSelected(isSel ? null : f.key); }}
                        className={`flex items-start gap-1.5 px-1.5 py-1 rounded cursor-pointer select-none
                          ${isSel ? "bg-blue-100" : active ? "bg-slate-50 hover:bg-slate-100" : "hover:bg-slate-50"}`}>
                        <input type="checkbox" checked={active}
                          onChange={() => toggleStaticField(f.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 flex-shrink-0 cursor-pointer" />
                        <div className="min-w-0">
                          <p className={`text-[11px] leading-tight ${isSel ? "text-blue-700 font-semibold" : active ? "font-medium text-slate-700" : "text-slate-500"}`}>
                            {f.label}
                          </p>
                          {f.example && <p className="text-[10px] text-slate-400 truncate">{f.example}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Dynamic concept fields */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide px-1 mb-1
              ${schoolConcepts.some((c) => isActive(`concept:${c.id}`)) ? "text-blue-600" : "text-slate-400"}`}>
              Conceptos del colegio
            </p>

            {conceptFields.length > 0 && (
              <label className="flex items-center gap-1.5 px-1 mb-1 text-[10px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={allConceptAmount}
                  onChange={(e) => setShowAmountAll(e.target.checked)} />
                Imprimir monto en todos los conceptos
              </label>
            )}

            {schoolConcepts.length === 0 ? (
              <p className="text-[10px] text-slate-400 px-1 italic">
                No hay conceptos de pago activos configurados.
              </p>
            ) : (
              <div className="space-y-0.5">
                {schoolConcepts.map((concept) => {
                  const key    = `concept:${concept.id}`;
                  const active = isActive(key);
                  const isSel  = selected === key;
                  return (
                    <div key={key}
                      onClick={() => { if (active) setSelected(isSel ? null : key); }}
                      className={`flex items-start gap-1.5 px-1.5 py-1 rounded cursor-pointer select-none
                        ${isSel ? "bg-blue-100" : active ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={active}
                        onChange={() => toggleConceptField(concept)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex-shrink-0 cursor-pointer" />
                      <div className="min-w-0">
                        <p className={`text-[11px] leading-tight ${isSel ? "text-blue-700 font-semibold" : active ? "font-medium text-amber-700" : "text-slate-500"}`}>
                          {concept.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {getField(key)?.show_amount ? "imprime el monto pagado" : 'marca "✓" si fue pagado'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-w-0">
        <p className="text-[11px] text-muted-foreground mb-1.5">
          Arrastra para mover · Borde derecho azul para cambiar ancho · Clic para editar fuente
        </p>

        <div
          style={{ position: "relative", width: CANVAS_W, height: canvasH, background: "white", border: "1px solid #cbd5e1", cursor: "default", flexShrink: 0, userSelect: "none" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelected(null)}
        >
          {backgroundUrl && (
            <img src={backgroundUrl} alt="" draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }} />
          )}

          {/* Grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {Array.from({ length: Math.floor(paperWidthMm  / 10) - 1 }).map((_, i) => (
              <line key={`v${i}`} x1={(i+1)*10*scale} y1={0}              x2={(i+1)*10*scale} y2={canvasH}  stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {Array.from({ length: Math.floor(paperHeightMm / 10) - 1 }).map((_, i) => (
              <line key={`h${i}`} x1={0}              y1={(i+1)*10*scale} x2={CANVAS_W}       y2={(i+1)*10*scale} stroke="#f1f5f9" strokeWidth="1" />
            ))}
            {Array.from({ length: Math.floor(paperWidthMm / 10) }).map((_, i) => (
              <text key={`rl${i}`} x={(i+1)*10*scale - 6} y={8} fontSize={6} fill="#cbd5e1" fontFamily="monospace">{(i+1)*10}</text>
            ))}
          </svg>

          {/* Field boxes */}
          {fields.map((f) => {
            const isSel     = selected === f.key;
            const isConcept = f.key.startsWith("concept:");
            const label     = resolveLabel(f.key);
            const sample    = resolveSample(f.key);
            const fontPx    = Math.max(7, (f.font_size_pt * 25.4) / 72 * scale);

            return (
              <div key={f.key}
                style={{
                  position:   "absolute",
                  left:       f.x_mm     * scale,
                  top:        f.y_mm     * scale,
                  width:      f.width_mm * scale,
                  // La caja mide lo que ocupa el texto impreso: lo que se ve aquí es lo que
                  // sale en el papel (mismo origen x_mm/y_mm y misma altura de línea)
                  height:     Math.max(fontPx, 10),
                  cursor:     "move",
                  border:     isSel ? "1.5px solid #2563eb" : isConcept ? "1px dashed #d97706" : "1px dashed #94a3b8",
                  background: isSel ? "rgba(219,234,254,0.65)" : isConcept ? "rgba(254,243,199,0.6)" : "rgba(248,250,252,0.55)",
                  boxSizing:  "border-box",
                  overflow:   "hidden",
                }}
                onMouseDown={(e) => startDrag(e, f.key, "move")}
                onClick={(e) => { e.stopPropagation(); setSelected(f.key); }}
              >
                {/* Etiqueta FUERA de la caja: dentro empujaba el valor hacia abajo y lo que se
                    guardaba (y_mm) quedaba unos milímetros más arriba de lo que se veía */}
                <div style={{ position: "absolute", bottom: "100%", left: 0, fontSize: 7, color: isSel ? "#1d4ed8" : isConcept ? "#92400e" : "#94a3b8", lineHeight: 1, fontFamily: "sans-serif", whiteSpace: "nowrap", pointerEvents: "none" }}>
                  {label}
                </div>
                {/* El valor arranca justo en el borde superior de la caja: ahí es donde imprime */}
                <div style={{ fontSize: fontPx, fontWeight: f.bold ? "bold" : "normal", fontFamily: "Arial, Helvetica, sans-serif", color: "#0f172a", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {sample}
                </div>
                {/* Resize grip */}
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
