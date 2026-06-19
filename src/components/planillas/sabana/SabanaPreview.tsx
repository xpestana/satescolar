import { useEffect, useRef, useState, CSSProperties, Fragment } from "react";
import { SabanaDisplayConfig } from "@/hooks/useSabanaConfig";

const PAGE_W_MM = 297; // A4 landscape
const PAGE_H_MM = 210;
const MM_TO_PX = 3.7795; // 96 DPI: 1mm ≈ 3.7795px
const PAGE_W_PX = PAGE_W_MM * MM_TO_PX; // ~1122px

const SAMPLE_SCHOOL = "UNIDAD EDUCATIVA COLEGIO EJEMPLO";
const SAMPLE_SUBJECTS = ["MAT", "FIS", "QUI", "ING", "BIO", "EF", "ED"];
const SAMPLE_STUDENTS = [
  { n: 1, cedula: "V-12345678", name: "GARCIA PEREZ CARLOS ANDRES", grades: [15, 12, 8, 18, 14, 16, 20] },
  { n: 2, cedula: "V-23456789", name: "LOPEZ MARTINEZ ANA BEATRIZ", grades: [11, 14, 16, 9, 12, 18, 15] },
  { n: 3, cedula: "V-34567890", name: "RODRIGUEZ SILVA PEDRO JOSE", grades: [20, 18, 15, 17, 19, 20, 18] },
  { n: 4, cedula: "V-45678901", name: "FERNANDEZ TORRES MARIA G.", grades: [13, 16, 11, 14, 10, 15, 12] },
];

function colAvg(si: number): string {
  const vals = SAMPLE_STUDENTS.map(s => s.grades[si]);
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function rowAvg(grades: number[]): string {
  return (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1);
}

function overallAvg(): string {
  const avgs = SAMPLE_STUDENTS.map(s => s.grades.reduce((a, b) => a + b, 0) / s.grades.length);
  return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1);
}

function th(bg: string, fontSize: number, extra?: CSSProperties): CSSProperties {
  return {
    backgroundColor: bg,
    color: "white",
    textAlign: "center",
    fontSize: `${fontSize}pt`,
    fontWeight: "bold",
    padding: "1.5mm 1mm",
    border: "0.1mm solid #000",
    whiteSpace: "nowrap",
    ...extra,
  };
}

function td(fontSize: number, halign: CSSProperties["textAlign"] = "center", extra?: CSSProperties): CSSProperties {
  return {
    textAlign: halign,
    fontSize: `${fontSize}pt`,
    padding: "1.5mm 1mm",
    border: "0.1mm solid #000",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    ...extra,
  };
}

const NAME_WRAP: CSSProperties = {
  whiteSpace: "normal",
  wordBreak: "break-word",
  lineHeight: 1.3,
};

interface Props {
  config: SabanaDisplayConfig;
  momento: string;
}

export function SabanaPreview({ config, momento }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function recalc() {
      if (containerRef.current) setScale(containerRef.current.offsetWidth / PAGE_W_PX);
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isDefinitiva = momento === "definitiva";
  const subjects = isDefinitiva ? SAMPLE_SUBJECTS.slice(0, 3) : SAMPLE_SUBJECTS;
  const { headerColor, marginX, marginY, tableFontSize, headerFontSize } = config;

  const momentoLabel = isDefinitiva ? "NOTAS DEFINITIVAS" : `NOTAS DEL MOMENTO ${momento}`;
  const nowStr = `${new Date().toLocaleDateString("es-VE")} ${new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Vista previa (datos de ejemplo)</p>
      <div
        ref={containerRef}
        className="w-full rounded-lg border bg-muted/20 overflow-hidden"
        style={{ height: `${PAGE_H_MM * MM_TO_PX * scale}px` }}
      >
        <div
          style={{
            width: `${PAGE_W_MM}mm`,
            height: `${PAGE_H_MM}mm`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "white",
            fontFamily: "Arial, Helvetica, sans-serif",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          {/* Timestamp */}
          <div style={{
            position: "absolute", top: "5mm", right: `${marginX}mm`,
            fontSize: "6pt", color: "#828282",
          }}>
            Impreso: {nowStr}
          </div>

          {/* Content */}
          <div style={{ paddingTop: `${marginY}mm`, paddingLeft: `${marginX}mm`, paddingRight: `${marginX}mm` }}>
            <div style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", lineHeight: 1.4 }}>{SAMPLE_SCHOOL}</div>
            <div style={{ textAlign: "center", fontSize: "10pt", fontWeight: "bold", lineHeight: 1.4 }}>{momentoLabel}</div>
            <div style={{ textAlign: "center", fontSize: "10pt", lineHeight: 1.4, marginBottom: "2mm" }}>
              3er Año - Sección: A &nbsp;|&nbsp; Año Escolar: 2025-2026
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                {isDefinitiva ? (
                  <>
                    <tr>
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { width: "5mm" })}>N°</th>
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { width: "18mm" })}>Cédula</th>
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { textAlign: "left", width: "36mm", whiteSpace: "normal" })}>Apellidos y Nombres</th>
                      {subjects.map(s => (
                        <th key={s} colSpan={4} style={th(headerColor, headerFontSize)}>{s}</th>
                      ))}
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { width: "10mm" })}>Prom</th>
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { width: "8mm" })}>Pos</th>
                      <th rowSpan={2} style={th(headerColor, headerFontSize, { width: "10mm" })}>Aplaz</th>
                    </tr>
                    <tr>
                      {subjects.map(s =>
                        ["1", "2", "3", "D"].map(sub => (
                          <th key={`${s}-${sub}`} style={th(headerColor, headerFontSize)}>{sub}</th>
                        ))
                      )}
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th style={th(headerColor, headerFontSize, { width: "6mm" })}>N°</th>
                    <th style={th(headerColor, headerFontSize, { width: "20mm" })}>Cédula</th>
                    <th style={th(headerColor, headerFontSize, { textAlign: "left", width: "44mm", whiteSpace: "normal" })}>Apellidos y Nombres</th>
                    {subjects.map(s => <th key={s} style={th(headerColor, headerFontSize)}>{s}</th>)}
                    <th style={th(headerColor, headerFontSize, { width: "10mm" })}>Prom</th>
                    <th style={th(headerColor, headerFontSize, { width: "8mm" })}>Pos</th>
                    <th style={th(headerColor, headerFontSize, { width: "10mm" })}>Aplaz</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {SAMPLE_STUDENTS.map((student, rowIdx) => (
                  <tr key={student.n}>
                    <td style={td(tableFontSize)}>{student.n}</td>
                    <td style={td(tableFontSize)}>{student.cedula}</td>
                    <td style={td(tableFontSize, "left", NAME_WRAP)}>{student.name}</td>
                    {isDefinitiva
                      ? subjects.map((_, si) => (
                          <Fragment key={si}>
                            {[0, 1, 2].map(mi => (
                              <td key={mi} style={td(tableFontSize, "center", student.grades[si] < 10 ? { color: "#DC3232" } : undefined)}>
                                {student.grades[si]}
                              </td>
                            ))}
                            <td style={td(tableFontSize, "center", { fontWeight: "bold" })}>
                              {student.grades[si]}
                            </td>
                          </Fragment>
                        ))
                      : subjects.map((_, si) => (
                          <td key={si} style={td(tableFontSize, "center", student.grades[si] < 10 ? { color: "#DC3232" } : undefined)}>
                            {student.grades[si]}
                          </td>
                        ))
                    }
                    <td style={td(tableFontSize)}>{rowAvg(subjects.map((_, si) => student.grades[si]))}</td>
                    <td style={td(tableFontSize)}>{rowIdx + 1}</td>
                    <td style={td(tableFontSize)}>{student.grades.filter(g => g < 10).length}</td>
                  </tr>
                ))}

                {/* Averages row */}
                <tr style={{ backgroundColor: "#E6F0FA" }}>
                  <td style={td(tableFontSize, "center", { fontWeight: "bold" })}></td>
                  <td style={td(tableFontSize, "center", { fontWeight: "bold" })}></td>
                  <td style={td(tableFontSize, "left", { ...NAME_WRAP, fontWeight: "bold" })}>PROMEDIOS</td>
                  {isDefinitiva
                    ? subjects.map((_, si) => (
                        <Fragment key={si}>
                          {[0, 1, 2].map(mi => (
                            <td key={mi} style={td(tableFontSize, "center", { fontWeight: "bold" })}>{colAvg(si)}</td>
                          ))}
                          <td style={td(tableFontSize, "center", { fontWeight: "bold" })}>{colAvg(si)}</td>
                        </Fragment>
                      ))
                    : subjects.map((_, si) => (
                        <td key={si} style={td(tableFontSize, "center", { fontWeight: "bold" })}>{colAvg(si)}</td>
                      ))
                  }
                  <td style={td(tableFontSize, "center", { fontWeight: "bold" })}>{overallAvg()}</td>
                  <td style={td(tableFontSize, "center", { fontWeight: "bold" })}></td>
                  <td style={td(tableFontSize, "center", { fontWeight: "bold" })}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{
            position: "absolute", bottom: "5mm",
            left: `${marginX}mm`, right: `${marginX}mm`,
            textAlign: "center", fontSize: "7pt", color: "#828282",
          }}>
            {isDefinitiva
              ? "Números en rojo (esquina) = Puntos de ajuste  |  D = Definitiva (promedio de los 3 momentos)"
              : "Números en rojo (esquina) = Puntos de ajuste"
            }
          </div>
        </div>
      </div>
    </div>
  );
}
