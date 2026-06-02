import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface School { id: string; name: string; }

interface UIGrade {
  document_id: string;
  student_name: string;
  area_name: string;
  literal_numerico: string; // editable string
  literal: string;          // editable letter
}

const GRADE_OPTIONS = [
  "I Nivel", "II Nivel", "III Nivel",
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
  "1er Año", "2do Año", "3er Año", "4to Año", "5to Año", "6to Año",
];
// Áreas que se califican con literal A-E (primaria)
const PRIMARY_AREAS = new Set(["1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado"]);

// Patrón confirmado: A=19-20, B=16-18, C=13-15, D=11-12, E=<=10
function letterFor(n: number): string {
  if (isNaN(n)) return "";
  if (n >= 19) return "A";
  if (n >= 16) return "B";
  if (n >= 13) return "C";
  if (n >= 11) return "D";
  return "E";
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
      if (calif === null || calif === undefined || String(calif).trim() === "") continue; // sin nota -> omitir
      const num = Number(calif);
      const docId = normalizeDoc(get("cedula"));
      const area = normalizeGrade(get("grado"));
      out.push({
        document_id: docId,
        student_name: String(get("nombre") ?? "").trim(),
        area_name: area,
        literal_numerico: Number.isNaN(num) ? String(calif) : String(num),
        literal: letterFor(num),
      });
    }
  }
  return out;
}

export default function ImportGrades() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<UIGrade[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<any>(null);

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

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      if (!Array.isArray(raw?.representantes)) {
        toast.error("El JSON no contiene 'representantes'");
        return;
      }
      const parsedRows = parseGrades(raw);
      setRows(parsedRows);
      setParsed(true);
      toast.success(`${parsedRows.length} calificaciones detectadas`);
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo leer el JSON: " + (e?.message || "formato inválido"));
    }
  };

  const updateRow = (i: number, patch: Partial<UIGrade>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const nonPrimary = useMemo(() => rows.filter((r) => !PRIMARY_AREAS.has(r.area_name)), [rows]);
  const missingDoc = useMemo(() => rows.filter((r) => !r.document_id), [rows]);

  const handleImport = async () => {
    if (!schoolId) { toast.error("Selecciona el colegio destino"); return; }
    if (!confirm("¿Cargar estas calificaciones como Definitiva Final del año 2024-2025?")) return;
    setImporting(true);
    setReport(null);
    try {
      const payload = {
        school_id: schoolId,
        school_year: "2024-2025",
        items: rows.map((r) => ({
          document_id: r.document_id,
          area_name: r.area_name,
          literal_numerico: r.literal_numerico === "" ? null : Number(r.literal_numerico),
          literal: r.literal,
        })),
      };
      const { data, error } = await supabase.functions.invoke("import-grades", { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReport(data);
      const errs = data?.summary?.errores ?? 0;
      if (errs > 0) toast.warning(`Finalizado con ${errs} incidencia(s). Revisa el reporte.`);
      else toast.success("Calificaciones cargadas correctamente");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Error en la importación");
      setReport({ error: e?.message });
    } finally {
      setImporting(false);
    }
  };

  const fieldCls = "h-8 text-xs";

  return (
    <DashboardLayout>
      <PageHeader
        title="Importar Calificaciones (JSON)"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Importar Calificaciones" }]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" /> Cargar archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertDescription className="text-xs">
              Busca al estudiante por <b>cédula</b>, ubica el <b>área</b> según su grado y guarda la
              <b> calificación</b> como <b>Definitiva Final</b> del año <b>2024-2025</b> (literal numérico + letra A–E).
              Patrón de letras: A=19-20, B=16-18, C=13-15, D=11-12, E=10 o menos.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Colegio destino</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un colegio" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archivo JSON</Label>
              <Input type="file" accept="application/json,.json" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            </div>
          </div>
          {parsed && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="secondary">{rows.length} calificaciones</Badge>
              {nonPrimary.length > 0 && <Badge variant="destructive">{nonPrimary.length} fuera de primaria</Badge>}
              {missingDoc.length > 0 && <Badge variant="destructive">{missingDoc.length} sin cédula</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <>
          {(nonPrimary.length > 0 || missingDoc.length > 0) && (
            <Alert className="mb-6 border-orange-300 bg-orange-50 text-orange-900">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle>Avisos</AlertTitle>
              <AlertDescription className="text-xs space-y-1 mt-2">
                {nonPrimary.length > 0 && (
                  <div>⚠️ <b>Áreas no primaria</b> (el patrón A–E es para primaria; revísalas): {[...new Set(nonPrimary.map((r) => r.area_name))].join(", ")}</div>
                )}
                {missingDoc.length > 0 && (
                  <div>⛔ <b>Sin cédula</b> (no se podrán ubicar): {missingDoc.length} registro(s)</div>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.student_name}</TableCell>
                        <TableCell className="text-xs">{r.document_id || <span className="text-red-500">(sin cédula)</span>}</TableCell>
                        <TableCell>
                          <Input className={`${fieldCls} ${!PRIMARY_AREAS.has(r.area_name) ? "border-orange-400" : ""}`} value={r.area_name} onChange={(e) => updateRow(i, { area_name: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number" min={0} max={20} step={1}
                            className={fieldCls}
                            value={r.literal_numerico}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateRow(i, { literal_numerico: v, literal: v === "" ? "" : letterFor(Number(v)) });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input className={`${fieldCls} text-center font-semibold uppercase`} maxLength={1}
                            value={r.literal}
                            onChange={(e) => updateRow(i, { literal: e.target.value.toUpperCase().replace(/[^A-E]/g, "").slice(0, 1) })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 mb-10">
            <Button onClick={handleImport} disabled={importing || !schoolId} size="lg">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : <><Upload className="h-4 w-4 mr-2" /> Cargar calificaciones</>}
            </Button>
            <p className="text-xs text-muted-foreground">Se guarda en la Definitiva Final del año 2024-2025. Visible en Notas y Boletas.</p>
          </div>
        </>
      )}

      {report && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {report.error ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}
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
                    <Badge key={k} variant={k === "errores" && (v as number) > 0 ? "destructive" : "secondary"}>{k}: {String(v)}</Badge>
                  ))}
                </div>
                {Array.isArray(report.failed) && report.failed.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-1">Incidencias ({report.failed.length})</p>
                    <pre className="text-[11px] bg-red-50 text-red-800 p-3 rounded max-h-64 overflow-auto">{report.failed.join("\n")}</pre>
                  </div>
                )}
                {Array.isArray(report.created) && (
                  <details>
                    <summary className="text-sm cursor-pointer">Guardadas ({report.created.length})</summary>
                    <pre className="text-[11px] bg-muted p-3 rounded max-h-64 overflow-auto mt-1">{report.created.join("\n")}</pre>
                  </details>
                )}
                {Array.isArray(report.skipped) && report.skipped.length > 0 && (
                  <details>
                    <summary className="text-sm cursor-pointer">Omitidas ({report.skipped.length})</summary>
                    <pre className="text-[11px] bg-muted p-3 rounded max-h-64 overflow-auto mt-1">{report.skipped.join("\n")}</pre>
                  </details>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
