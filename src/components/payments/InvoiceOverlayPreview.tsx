import { OVERLAY_FIELDS, InvoiceTemplate, OverlayField } from "@/pages/school/InvoiceTemplateConfig";
import { isConceptField, resolveOverlayValue } from "@/lib/invoiceFieldValue";

// Demo data for preview
const SAMPLE_DATA: Record<string, string> = {
  invoice_number:      "016725",
  control_number:      "00-00016725",
  date_day:            "11",
  date_month:          "05",
  date_year:           "2026",
  titular_nombre:      "María González",
  titular_ci:          "V-15.234.567",
  student_name:        "Ana María González / Luis González",
  student_grade:       "3er Año",
  student_section:     "A",
  // Un bloque por hijo, para facturas familiares
  student_name_1:      "Ana María González",
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
  concept_6_name:      "",
  concept_6_amount:    "",
  concept_7_name:      "",
  concept_7_amount:    "",
  concept_8_name:      "",
  concept_8_amount:    "",
  concept_9_name:      "",
  concept_9_amount:    "",
  concept_10_name:     "",
  concept_10_amount:   "",
  total_amount:        "7.000,00",
  payment_method_text: "Transferencia Bancaria",
};

interface Props {
  template: InvoiceTemplate;
  paymentData?: Record<string, string>;
  scale?: number; // default 2 (50% scale for preview)
}

export function InvoiceOverlayPreview({ template, paymentData, scale = 2 }: Props) {
  const data = paymentData || SAMPLE_DATA;
  const pxPerMm = 3.7795275591; // 96dpi
  const widthPx = template.paper_width_mm * pxPerMm;
  const heightPx = template.paper_height_mm * pxPerMm;

  return (
    <div className="overflow-auto">
      <p className="text-xs text-muted-foreground mb-2">
        Vista previa a escala {Math.round(100 / scale)}% — los campos en azul muestran dónde se imprimirá cada dato.
      </p>
      <div
        style={{
          position: "relative",
          width: widthPx / scale,
          height: heightPx / scale,
          border: "1px solid #e2e8f0",
          backgroundColor: "white",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Background scan */}
        {template.background_image_url && (
          <img
            src={template.background_image_url}
            alt="Factura"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "fill",
              opacity: 0.6,
            }}
          />
        )}

        {/* Overlay fields */}
        {(template.fields || []).map((field: OverlayField) => {
          const meta = OVERLAY_FIELDS.find((f) => f.key === field.key);
          const sample = isConceptField(field.key)
            ? (field.show_amount ? "5.000,00" : "✓")     // concept fields have no static example
            : (meta?.example ?? "");
          const value = resolveOverlayValue(field, data) || sample;
          if (!value) return null;
          return (
            <div
              key={field.key}
              style={{
                position: "absolute",
                left: (field.x_mm * pxPerMm) / scale,
                top: (field.y_mm * pxPerMm) / scale,
                width: (field.width_mm * pxPerMm) / scale,
                fontSize: field.font_size_pt / scale * (4 / 3), // pt to px / scale
                fontWeight: field.bold ? "bold" : "normal",
                fontFamily: "Arial, sans-serif",
                color: "#1d4ed8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
              title={`${field.label ?? meta?.label ?? field.key}: ${value}`}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
