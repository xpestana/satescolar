import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface School { id: string; name: string; }

// ── Primaria ──────────────────────────────────────────────────────────────────
interface UIGrade {
  document_id: string;
  student_name: string;
  area_name: string;
  literal_numerico: string;
  literal: string;
  final_status: string;
}

// ── Bachillerato ──────────────────────────────────────────────────────────────
interface UIGradeBach {
  document_id: string;
  student_name: string;
  area_name: string;
  grade_value: string;  // String(nota) — puede ser "17" o "A"
  final_status: string;
}

const STATUS_OPTIONS = [
  { value: "aprobado", label: "Aprobado" },
  { value: "no_aprobado", label: "No Aprobado" },
  { value: "no_cursante", label: "No Cursante" },
  { value: "pp", label: "PP" },
];

const GRADE_OPTIONS = [
  "I Nivel", "II Nivel", "III Nivel",
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
  "1er Año", "2do Año", "3er Año", "4to Año", "5to Año", "6to Año",
];

const PRIMARY_AREAS = new Set([
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function estadoFor(n: number): string {
  if (isNaN(n)) return "";
  return n > 10 ? "aprobado" : "no_aprobado";
}

function letterFor(n: number): string {
  if (isNaN(n)) return "";
  if (n >= 19) return "A";
  if (n >= 16) return "B";
  if (n >= 13) return "C";
  if (n >= 11) return "D";
  return "E";
}

function estadoForLetter(letter: string): string {
  const l = String(letter).trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(l)) return "aprobado";
  if (l === "E") return "no_aprobado";
  return "";
}

function normalizeDoc(raw: unknown): string {
  let s = String(raw ?? "").trim().replace(/\.0+$/, "");
  const m = s.match(/^([VvEe])-?(\d+)$/);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  const digits = s.replace(/\D/g, "");
  return digits ? `V-${digits}` : "";
}

function normalizeGrade(raw: unknown): string {
  const norm = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return GRADE_OPTIONS.find((g) => g.toLowerCase() === norm) ?? String(raw ?? "").trim();
}

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseGrades(raw: any): UIGrade[] {
  const repsRaw: any[] = Array.isArray(raw?.representantes) ? raw.representantes : [];
  const out: UIGrade[] = [];
  for (const r of repsRaw) {
    const hijos: any[] = Array.isArray(r?.hijos) ? r.hijos : [];
    for (const h of hijos) {
      const key = Object.keys(h).find((k) => /^nombre_hijo_\d+$/.test(k));
      const n = key ? key.match(/(\d+)$/)![1] : "1";
      const get = (base: string) => h[`${base}_hijo_${n}`];
      const calif = get("calificacion");
      if (calif === null || calif === undefined || String(calif).trim() === "") continue;
      const num = Number(calif);
      const docId = normalizeDoc(get("cedula"));
      const area = normalizeGrade(get("grado"));
      out.push({
        document_id: docId,
        student_name: String(get("nombre") ?? "").trim(),
        area_name: area,
        literal_numerico: Number.isNaN(num) ? String(calif) : String(num),
        literal: letterFor(num),
        final_status: estadoFor(num),
      });
    }
  }
  return out;
}

function parseGradesBachillerato(raw: any): UIGradeBach[] {
  const repsRaw: any[] = Array.isArray(raw?.representantes) ? raw.representantes : [];
  const out: UIGradeBach[] = [];
  for (const r of repsRaw) {
    const hijos: any[] = Array.isArray(r?.hijos) ? r.hijos : [];
    for (const h of hijos) {
      if (!Array.isArray(h?.calificaciones)) continue;
      const docId = normalizeDoc(h.cedula);
      const studentName = `${String(h.nombre ?? "").trim()} ${String(h.apellido ?? "").trim()}`.trim();
      for (const c of h.calificaciones) {
        const rawNota = c?.nota;
        if (rawNota === null || rawNota === undefined || String(rawNota).trim() === "") continue;
        const gradeValue = String(rawNota).trim();
        const num = Number(gradeValue);
        const finalStatus = !isNaN(num) ? estadoFor(num) : estadoForLetter(gradeValue);
        out.push({
          document_id: docId,
          student_name: studentName,
          area_name: String(c?.area_formacion ?? "").trim(),
          grade_value: gradeValue,
          final_status: finalStatus,
        });
      }
    }
  }
  return out;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ImportGrades() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");

  // Primaria state
  const [fileNameP, setFileNameP] = useState("");
  const [rowsP, setRowsP] = useState<UIGrade[]>([]);
  const [parsedP, setParsedP] = useState(false);
  const [importingP, setImportingP] = useState(false);
  const [reportP, setReportP] = useState<any>(null);

  // Bachillerato state
  const [fileNameB, setFileNameB] = useState("");
  const [rowsB, setRowsB] = useState<UIGradeBach[]>([]);
  const [parsedB, setParsedB] = useState(false);
  const [importingB, setImportingB] = useState(false);
  const [reportB, setReportB] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) { toast.error("Error cargando colegios"); return; }
      setSchools(data || []);
      const mlk = (data || []).find((s) => /martin\s+luther\s+king|\bmlk\b/i.test(s.name));
      if (mlk) setSchoolId(mlk.id);
      else if (data && data.length > 0) setSchoolId(data[0].id);
    })();
  }, []);

  // ── Primaria handlers ──
  const handleFileP = async (file: File | null) => {
    if (!file) return;
    setFileNameP(file.name);
    setReportP(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      if (!Array.isArray(raw?.representantes)) {
        toast.error("El JSON no contiene 'representantes'");
        return;
      }
      const parsed = parseGrades(raw);
      setRowsP(parsed);
      setParsedP(true);
      toast.success(`${parsed.length} calificaciones detectadas`);
    } catch (e: any) {
      toast.error("No se pudo leer el JSON: " + (e?.message || "formato inválido"));
    }
  };

  const updateRowP = (i: number, patch: Partial<UIGrade>) =>
    setRowsP((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const nonPrimary = useMemo(() => rowsP.filter((r) => !PRIMARY_AREAS.has(r.area_name)), [rowsP]);
  const missingDocP = useMemo(() => rowsP.filter((r) => !r.document_id), [rowsP]);

  const handleImportP = async () => {
    if (!schoolId) { toast.error("Selecciona el colegio destino"); return; }
    if (!confirm("¿Cargar estas calificaciones como Definitiva Final del año 2024-2025?")) return;
    setImportingP(true);
    setReportP(null);
    try {
      const payload = {
        school_id: schoolId,
        school_year: "2024-2025",
        items: rowsP.map((r) => ({
          document_id: r.document_id,
          area_name: r.area_name,
          literal_numerico: r.literal_numerico === "" ? null : Number(r.literal_numerico),
          literal: r.literal,
          final_status: r.final_status || null,
        })),
      };
      const { data, error } = await supabase.functions.invoke("import-grades", { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReportP(data);
      const errs = data?.summary?.errores ?? 0;
      if (errs > 0) toast.warning(`Finalizado con ${errs} incidencia(s). Revisa el reporte.`);
      else toast.success("Calificaciones cargadas correctamente");
    } catch (e: any) {
      toast.error(e?.message || "Error en la importación");
      setReportP({ error: e?.message });
    } finally {
      setImportingP(false);
    }
  };

  // ── Bachillerato handlers ──
  const handleFileB = async (file: File | null) => {
    if (!file) return;
    setFileNameB(file.name);
    setReportB(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      if (!Array.isArray(raw?.representantes)) {
        toast.error("El JSON no contiene 'representantes'");
        return;
      }
      const parsed = parseGradesBachillerato(raw);
      setRowsB(parsed);
      setParsedB(true);
      toast.success(`${parsed.length} calificaciones detectadas`);
    } catch (e: any) {
      toast.error("No se pudo leer el JSON: " + (e?.message || "formato inválido"));
    }
  };

  const updateRowB = (i: number, patch: Partial<UIGradeBach>) =>
    setRowsB((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const missingDocB = useMemo(() => rowsB.filter((r) => !r.document_id), [rowsB]);

  const handleImportB = async () => {
    if (!schoolId) { toast.error("Selecciona el colegio destino"); return; }
    if (!confirm("¿Cargar estas calificaciones como Definitiva Final del año 2024-2025?")) return;
    setImportingB(true);
    setReportB(null);
    try {
      const payload = {
        school_id: schoolId,
        school_year: "2024-2025",
        items: rowsB.map((r) => ({
          document_id: r.document_id,
          area_name: r.area_name,
          grade_value: r.grade_value || null,
          final_status: r.final_status || null,
        })),
      };
      const { data, error } = await supabase.functions.invoke("import-bachillerato-grades", { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReportB(data);
      const errs = data?.summary?.errores ?? 0;
      if (errs > 0) toast.warning(`Finalizado con ${errs} incidencia(s). Revisa el reporte.`);
      else toast.success("Calificaciones cargadas correctamente");
    } catch (e: any) {
      toast.error(e?.message || "Error en la importación");
      setReportB({ error: e?.message });
    } finally {
      setImportingB(false);
    }
  };

  const fieldCls = "h-8 text-xs";

  const SchoolSelector = () => (
    <div className="space-y-2">
      <Label>Colegio destino</Label>
      <Select value={schoolId} onValueChange={setSchoolId}>
        <SelectTrigger><SelectValue placeholder="Selecciona un colegio" /></SelectTrigger>
        <SelectContent>
          {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const ReportCard = ({ report }: { report: any }) => (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {report.error
            ? <AlertTriangle className="h-5 w-5 text-red-500" />
            : <CheckCircle2 className="h-5 w-5 text-primary" />}
          Reporte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.error ? (
          <p className="text-sm text-red-600">{report.error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(report.summary || {}).map(([k, v]) => (
                <Badge key={k} variant={k === "errores" && (v as number) > 0 ? "destructive" : "secondary"}>
                  {k}: {String(v)}
                </Badge>
              ))}
            </div>
            {Array.isArray(report.failed) && report.failed.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">Incidencias ({report.failed.length})</p>
                <pre className="text-[11px] bg-red-50 text-red-800 p-3 rounded max-h-64 overflow-auto">
                  {report.failed.join("\n")}
                </pre>
              </div>
            )}
            {Array.isArray(report.created) && (
              <details>
                <summary className="text-sm cursor-pointer">Guardadas ({report.created.length})</summary>
                <pre className="text-[11px] bg-muted p-3 rounded max-h-64 overflow-auto mt-1">
                  {report.created.join("\n")}
                </pre>
              </details>
            )}
            {Array.isArray(report.skipped) && report.skipped.length > 0 && (
              <details>
                <summary className="text-sm cursor-pointer">Omitidas ({report.skipped.length})</summary>
                <pre className="text-[11px] bg-muted p-3 rounded max-h-64 overflow-auto mt-1">
                  {report.skipped.join("\n")}
                </pre>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Importar Calificaciones (JSON)"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Importar Calificaciones" }]}
      />

      <Tabs defaultValue="primaria">
        <TabsList className="mb-6">
          <TabsTrigger value="primaria">Primaria</TabsTrigger>
          <TabsTrigger value="bachillerato">Bachillerato</TabsTrigger>
        </TabsList>

        {/* ════════ PRIMARIA ════════ */}
        <TabsContent value="primaria">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" /> Cargar archivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                <AlertDescription className="text-xs">
                  Busca al estudiante por <b>cédula</b>, ubica el <b>área</b> según su grado y guarda la{" "}
                  <b>calificación</b> como <b>Definitiva Final</b> del año <b>2024-2025</b>.
                  Patrón de letras: A=19-20, B=16-18, C=13-15, D=11-12, E=10 o menos.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                <SchoolSelector />
                <div className="space-y-2">
                  <Label>Archivo JSON</Label>
                  <Input
                    type="file" accept="application/json,.json"
                    onChange={(e) => handleFileP(e.target.files?.[0] || null)}
                  />
                  {fileNameP && <p className="text-xs text-muted-foreground">{fileNameP}</p>}
                </div>
              </div>
              {parsedP && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="secondary">{rowsP.length} calificaciones</Badge>
                  {nonPrimary.length > 0 && <Badge variant="destructive">{nonPrimary.length} fuera de primaria</Badge>}
                  {missingDocP.length > 0 && <Badge variant="destructive">{missingDocP.length} sin cédula</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          {parsedP && (
            <>
              {(nonPrimary.length > 0 || missingDocP.length > 0) && (
                <Alert className="mb-6 border-orange-300 bg-orange-50 text-orange-900">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertTitle>Avisos</AlertTitle>
                  <AlertDescription className="text-xs space-y-1 mt-2">
                    {nonPrimary.length > 0 && (
                      <div>
                        ⚠️ <b>Áreas no primaria</b>:{" "}
                        {[...new Set(nonPrimary.map((r) => r.area_name))].join(", ")}
                      </div>
                    )}
                    {missingDocP.length > 0 && (
                      <div>⛔ <b>Sin cédula</b>: {missingDocP.length} registro(s)</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="mb-6">
                <CardHeader><CardTitle>Vista previa</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Cédula</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead className="w-28">Núm. (Definitiva)</TableHead>
                          <TableHead className="w-20">Letra</TableHead>
                          <TableHead className="w-36">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rowsP.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.student_name}</TableCell>
                            <TableCell className="text-xs">
                              {r.document_id || <span className="text-red-500">(sin cédula)</span>}
                            </TableCell>
                            <TableCell>
                              <Input
                                className={`${fieldCls} ${!PRIMARY_AREAS.has(r.area_name) ? "border-orange-400" : ""}`}
                                value={r.area_name}
                                onChange={(e) => updateRowP(i, { area_name: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number" min={0} max={20} step={1} className={fieldCls}
                                value={r.literal_numerico}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateRowP(i, {
                                    literal_numerico: v,
                                    literal: v === "" ? "" : letterFor(Number(v)),
                                    final_status: v === "" ? "" : estadoFor(Number(v)),
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className={`${fieldCls} text-center font-semibold uppercase`}
                                maxLength={1} value={r.literal}
                                onChange={(e) =>
                                  updateRowP(i, {
                                    literal: e.target.value.toUpperCase().replace(/[^A-E]/g, "").slice(0, 1),
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={r.final_status} onValueChange={(v) => updateRowP(i, { final_status: v })}>
                                <SelectTrigger className={fieldCls}><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 mb-10">
                <Button onClick={handleImportP} disabled={importingP || !schoolId} size="lg">
                  {importingP
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                    : <><Upload className="h-4 w-4 mr-2" /> Cargar calificaciones</>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Se guarda en la Definitiva Final del año 2024-2025.
                </p>
              </div>
            </>
          )}

          {reportP && <ReportCard report={reportP} />}
        </TabsContent>

        {/* ════════ BACHILLERATO ════════ */}
        <TabsContent value="bachillerato">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" /> Cargar archivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                <AlertDescription className="text-xs">
                  Importa las calificaciones del array <b>calificaciones</b> de cada estudiante. Cada materia
                  se guarda como <b>Definitiva Final</b> (momento 0) del año <b>2024-2025</b>.
                  Las notas literales (A/B/C/D/E) de Orientación Vocacional se almacenan tal cual.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                <SchoolSelector />
                <div className="space-y-2">
                  <Label>Archivo JSON</Label>
                  <Input
                    type="file" accept="application/json,.json"
                    onChange={(e) => handleFileB(e.target.files?.[0] || null)}
                  />
                  {fileNameB && <p className="text-xs text-muted-foreground">{fileNameB}</p>}
                </div>
              </div>
              {parsedB && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="secondary">{rowsB.length} calificaciones</Badge>
                  <Badge variant="secondary">
                    {new Set(rowsB.map((r) => r.document_id)).size} estudiantes
                  </Badge>
                  {missingDocB.length > 0 && (
                    <Badge variant="destructive">{missingDocB.length} sin cédula</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {parsedB && (
            <>
              {missingDocB.length > 0 && (
                <Alert className="mb-6 border-orange-300 bg-orange-50 text-orange-900">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertTitle>Avisos</AlertTitle>
                  <AlertDescription className="text-xs mt-2">
                    ⛔ <b>Sin cédula</b> (no se podrán ubicar): {missingDocB.length} registro(s)
                  </AlertDescription>
                </Alert>
              )}

              <Card className="mb-6">
                <CardHeader><CardTitle>Vista previa</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estudiante</TableHead>
                          <TableHead>Cédula</TableHead>
                          <TableHead>Área / Materia</TableHead>
                          <TableHead className="w-28">Nota (Definitiva)</TableHead>
                          <TableHead className="w-36">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rowsB.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.student_name}</TableCell>
                            <TableCell className="text-xs">
                              {r.document_id || <span className="text-red-500">(sin cédula)</span>}
                            </TableCell>
                            <TableCell>
                              <Input
                                className={fieldCls}
                                value={r.area_name}
                                onChange={(e) => updateRowB(i, { area_name: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className={`${fieldCls} text-center font-semibold`}
                                value={r.grade_value}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  const num = Number(v);
                                  const fs = !isNaN(num) && v !== ""
                                    ? estadoFor(num)
                                    : estadoForLetter(v);
                                  updateRowB(i, { grade_value: v, final_status: fs });
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={r.final_status} onValueChange={(v) => updateRowB(i, { final_status: v })}>
                                <SelectTrigger className={fieldCls}><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 mb-10">
                <Button onClick={handleImportB} disabled={importingB || !schoolId} size="lg">
                  {importingB
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                    : <><Upload className="h-4 w-4 mr-2" /> Cargar calificaciones</>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Se guarda en la Definitiva Final del año 2024-2025.
                </p>
              </div>
            </>
          )}

          {reportB && <ReportCard report={reportB} />}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
