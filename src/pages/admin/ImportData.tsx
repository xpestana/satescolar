import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, FileJson, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface School {
  id: string;
  name: string;
}

interface UIChild {
  document_id: string | null;
  tipo_documento: string;
  documento: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  genero: string;
  fecha_nacimiento: string;
  nivel_grado: string;
  calificacion: string;
  entidad_federal: string;
  _origFecha: string; // raw value from JSON ("" if null)
}

interface UIRep {
  email: string;
  cedula: string;
  tipo_documento: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  telefono: string;
  direccion: string;
  hijos: UIChild[];
  _origEmail: string;
}

interface UITeacher {
  email: string;
  cedula: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  area_asignada: string;
  create_area: boolean;
}

const GRADE_OPTIONS = [
  "I Nivel", "II Nivel", "III Nivel",
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
  "1er Año", "2do Año", "3er Año", "4to Año", "5to Año", "6to Año",
];
const GENERO_OPTIONS = ["Femenino", "Masculino"];
const FECHA_PLACEHOLDER = "2000-01-01";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Normalization helpers ──
function fixEmail(raw: unknown): string {
  let v = String(raw ?? "").trim();
  v = v.replace(/@gmail\.(vom|con|cm|comm|co|comb|cob|om|coom)$/i, "@gmail.com");
  v = v.replace(/@hotmail\.(con|comm|co|hotmail)$/i, "@hotmail.com");
  return v;
}

function normalizeCedula(raw: unknown): string {
  // strips trailing ".0" float artifacts, then keeps digits only
  let s = String(raw ?? "").trim();
  s = s.replace(/\.0+$/, "");
  return s.replace(/\D/g, "");
}

function normalizeDoc(raw: unknown): { document_id: string | null; tipo_documento: string; documento: string } {
  let s = String(raw ?? "").trim();
  s = s.replace(/\.0+$/, "");
  const m = s.match(/^([VvEe])-?(\d+)$/);
  if (m) {
    const tipo = m[1].toUpperCase();
    return { document_id: `${tipo}-${m[2]}`, tipo_documento: tipo, documento: m[2] };
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return { document_id: null, tipo_documento: "V", documento: "" };
  return { document_id: `V-${digits}`, tipo_documento: "V", documento: digits };
}

function splitTwo(raw: unknown): [string, string] {
  const tokens = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return ["", ""];
  return [tokens[0], tokens.slice(1).join(" ")];
}

function splitChildName(raw: unknown): { pn: string; sn: string; pa: string; sa: string } {
  const t = String(raw ?? "").trim().split(/\s+/).filter(Boolean);
  let nombres: string[] = [];
  let apellidos: string[] = [];
  if (t.length >= 4) {
    nombres = t.slice(0, t.length - 2);
    apellidos = t.slice(t.length - 2);
  } else if (t.length === 3) {
    nombres = [t[0]];
    apellidos = t.slice(1);
  } else if (t.length === 2) {
    nombres = [t[0]];
    apellidos = [t[1]];
  } else {
    nombres = t;
    apellidos = [];
  }
  return {
    pn: nombres[0] || "",
    sn: nombres.slice(1).join(" "),
    pa: apellidos[0] || "",
    sa: apellidos.slice(1).join(" "),
  };
}

function mapGenero(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "F") return "Femenino";
  if (s === "M") return "Masculino";
  return "";
}

function normalizeGrade(raw: unknown): string {
  const norm = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const found = GRADE_OPTIONS.find((g) => g.toLowerCase() === norm);
  return found ?? String(raw ?? "").trim();
}

function extractChild(obj: Record<string, unknown>): UIChild {
  const key = Object.keys(obj).find((k) => /^nombre_hijo_\d+$/.test(k));
  const n = key ? key.match(/(\d+)$/)![1] : "1";
  const get = (base: string) => obj[`${base}_hijo_${n}`];

  const doc = normalizeDoc(get("cedula"));
  const split = splitChildName(get("nombre"));
  const rawFecha = get("fecha_nacimiento");
  const fecha = rawFecha ? String(rawFecha).trim() : "";
  const calif = get("calificacion");

  return {
    document_id: doc.document_id,
    tipo_documento: doc.tipo_documento,
    documento: doc.documento,
    primer_nombre: split.pn,
    segundo_nombre: split.sn,
    primer_apellido: split.pa,
    segundo_apellido: split.sa,
    genero: mapGenero(get("sexo")),
    fecha_nacimiento: fecha || FECHA_PLACEHOLDER,
    nivel_grado: normalizeGrade(get("grado")),
    calificacion: calif === null || calif === undefined ? "" : String(calif),
    entidad_federal: String(get("entidad_federal") ?? ""),
    _origFecha: fecha,
  };
}

function parseJson(raw: any): { reps: UIRep[]; docs: UITeacher[] } {
  const repsRaw: any[] = Array.isArray(raw?.representantes) ? raw.representantes : [];
  const docsRaw: any[] = Array.isArray(raw?.docentes) ? raw.docentes : [];

  // Group representatives by corrected email so repeated emails collapse into one family.
  const byEmail = new Map<string, UIRep>();
  for (const r of repsRaw) {
    const email = fixEmail(r?.email);
    const [pn, sn] = splitTwo(r?.nombre);
    const [pa, sa] = splitTwo(r?.apellido);
    const children = Array.isArray(r?.hijos) ? r.hijos.map((h: any) => extractChild(h)) : [];
    const keyEmail = email.toLowerCase() || `__sin_email_${byEmail.size}`;

    const existing = byEmail.get(keyEmail);
    if (existing) {
      existing.hijos.push(...children);
      if (!existing.cedula) existing.cedula = normalizeCedula(r?.cedula);
      continue;
    }
    byEmail.set(keyEmail, {
      email,
      cedula: normalizeCedula(r?.cedula),
      tipo_documento: "V",
      primer_nombre: pn,
      segundo_nombre: sn,
      primer_apellido: pa,
      segundo_apellido: sa,
      telefono: String(r?.telefono ?? "").trim(),
      direccion: String(r?.direccion ?? "").trim(),
      hijos: children,
      _origEmail: String(r?.email ?? "").trim(),
    });
  }

  const docs: UITeacher[] = docsRaw.map((d: any) => {
    const [pn, sn] = splitTwo(d?.nombres);
    const [pa, sa] = splitTwo(d?.apellidos);
    const area = String(d?.area_asignada ?? "").trim();
    return {
      email: fixEmail(d?.email),
      cedula: normalizeCedula(d?.cedula),
      primer_nombre: pn,
      segundo_nombre: sn,
      primer_apellido: pa,
      segundo_apellido: sa,
      area_asignada: area,
      create_area: area.toLowerCase() !== "dirección general" && area.toLowerCase() !== "direccion general",
    };
  });

  return { reps: Array.from(byEmail.values()), docs };
}

export default function ImportData() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [reps, setReps] = useState<UIRep[]>([]);
  const [docs, setDocs] = useState<UITeacher[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("schools").select("id, name").order("name");
      if (error) {
        toast.error("Error cargando colegios");
        return;
      }
      setSchools(data || []);
      const mlk = (data || []).find((s) => /martin\s+luther\s+king|\bmlk\b/i.test(s.name));
      if (mlk) setSchoolId(mlk.id);
      else if (data && data.length > 0) setSchoolId(data[0].id);
    })();
  }, []);

  const totalHijos = useMemo(() => reps.reduce((acc, r) => acc + r.hijos.length, 0), [reps]);
  const areasUnicas = useMemo(
    () => new Set(docs.filter((d) => d.create_area).map((d) => d.area_asignada)).size,
    [docs],
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      if (!Array.isArray(raw?.representantes) && !Array.isArray(raw?.docentes)) {
        toast.error("El JSON no contiene 'representantes' ni 'docentes'");
        return;
      }
      const { reps: r, docs: d } = parseJson(raw);
      setReps(r);
      setDocs(d);
      setParsed(true);
      toast.success(`Archivo analizado: ${r.length} familias, ${d.length} docentes`);
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo leer el JSON: " + (e?.message || "formato inválido"));
    }
  };

  const updateRep = (i: number, patch: Partial<UIRep>) =>
    setReps((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateChild = (ri: number, ci: number, patch: Partial<UIChild>) =>
    setReps((prev) =>
      prev.map((r, idx) =>
        idx === ri ? { ...r, hijos: r.hijos.map((c, cj) => (cj === ci ? { ...c, ...patch } : c)) } : r,
      ),
    );
  const updateDoc = (i: number, patch: Partial<UITeacher>) =>
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const buildPayload = () => ({
    school_id: schoolId,
    school_year: "2024-2025",
    representantes: reps.map((r) => ({
      email: r.email,
      cedula: r.cedula,
      tipo_documento: r.tipo_documento || "V",
      primer_nombre: r.primer_nombre,
      segundo_nombre: r.segundo_nombre,
      primer_apellido: r.primer_apellido,
      segundo_apellido: r.segundo_apellido,
      telefono: r.telefono,
      direccion: r.direccion,
      hijos: r.hijos.map((c) => ({
        document_id: c.document_id,
        tipo_documento: c.tipo_documento || "V",
        documento: c.documento,
        primer_nombre: c.primer_nombre,
        segundo_nombre: c.segundo_nombre,
        primer_apellido: c.primer_apellido,
        segundo_apellido: c.segundo_apellido,
        genero: c.genero,
        fecha_nacimiento: c.fecha_nacimiento,
        nivel_grado: c.nivel_grado,
        calificacion: c.calificacion,
        entidad_federal: c.entidad_federal,
      })),
    })),
    docentes: docs.map((d) => ({
      email: d.email,
      cedula: d.cedula,
      primer_nombre: d.primer_nombre,
      segundo_nombre: d.segundo_nombre,
      primer_apellido: d.primer_apellido,
      segundo_apellido: d.segundo_apellido,
      area_asignada: d.area_asignada,
      create_area: d.create_area,
    })),
  });

  const handleImport = async () => {
    if (!schoolId) {
      toast.error("Selecciona el colegio destino");
      return;
    }
    if (!confirm("¿Importar estos datos al colegio seleccionado? Esta acción crea usuarios y registros.")) return;
    setImporting(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-school-data", { body: buildPayload() });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReport(data);
      const errs = data?.summary?.errores ?? 0;
      if (errs > 0) toast.warning(`Importación finalizada con ${errs} incidencia(s). Revisa el reporte.`);
      else toast.success("Importación completada correctamente");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Error en la importación");
      setReport({ error: e?.message });
    } finally {
      setImporting(false);
    }
  };

  // ── Warnings summary ──
  const emailFixes = reps.filter((r) => r._origEmail && r._origEmail !== r.email);
  const missingCedula = reps.filter((r) => !r.cedula);
  const placeholderFechas = reps.flatMap((r) =>
    r.hijos.filter((c) => !c._origFecha).map((c) => `${c.primer_nombre} ${c.primer_apellido}`),
  );
  const unknownGrades = reps.flatMap((r) =>
    r.hijos.filter((c) => !GRADE_OPTIONS.includes(c.nivel_grado)).map((c) => c.nivel_grado),
  );
  const invalidEmails = [
    ...reps.filter((r) => !EMAIL_RE.test(r.email)).map((r) => r.email || "(vacío)"),
    ...docs.filter((d) => !EMAIL_RE.test(d.email)).map((d) => d.email || "(vacío)"),
  ];

  const fieldCls = "h-8 text-xs";

  return (
    <DashboardLayout>
      <PageHeader
        title="Importar Datos (JSON)"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Importar Datos" }]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" /> Cargar archivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Colegio destino</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un colegio" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
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
              <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {reps.length} familias</Badge>
              <Badge variant="secondary">{totalHijos} estudiantes</Badge>
              <Badge variant="secondary">{docs.length} docentes</Badge>
              <Badge variant="secondary">{areasUnicas} áreas</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <>
          {/* Warnings */}
          {(emailFixes.length > 0 || missingCedula.length > 0 || placeholderFechas.length > 0 || unknownGrades.length > 0 || invalidEmails.length > 0) && (
            <Alert className="mb-6 border-orange-300 bg-orange-50 text-orange-900">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle>Revisa estos datos antes de importar</AlertTitle>
              <AlertDescription className="text-xs space-y-1 mt-2">
                {emailFixes.length > 0 && (
                  <div>✏️ <b>Emails corregidos:</b> {emailFixes.map((r) => `${r._origEmail} → ${r.email}`).join("; ")}</div>
                )}
                {invalidEmails.length > 0 && (
                  <div>⛔ <b>Emails aún inválidos:</b> {invalidEmails.join(", ")} (corrígelos abajo)</div>
                )}
                {missingCedula.length > 0 && (
                  <div>🪪 <b>Sin cédula</b> (login con contraseña aleatoria): {missingCedula.map((r) => `${r.primer_nombre} ${r.primer_apellido}`).join(", ")}</div>
                )}
                {placeholderFechas.length > 0 && (
                  <div>📅 <b>Fecha de nacimiento placeholder ({FECHA_PLACEHOLDER}):</b> {placeholderFechas.join(", ")}</div>
                )}
                {unknownGrades.length > 0 && (
                  <div>🎓 <b>Grados no reconocidos</b> (sin inscripción): {[...new Set(unknownGrades)].join(", ")}</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Representatives */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Representantes y estudiantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reps.map((r, ri) => {
                const emailBad = !EMAIL_RE.test(r.email);
                return (
                  <div key={ri} className="rounded-lg border p-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Field label="1er nombre"><Input className={fieldCls} value={r.primer_nombre} onChange={(e) => updateRep(ri, { primer_nombre: e.target.value })} /></Field>
                      <Field label="2do nombre"><Input className={fieldCls} value={r.segundo_nombre} onChange={(e) => updateRep(ri, { segundo_nombre: e.target.value })} /></Field>
                      <Field label="1er apellido"><Input className={fieldCls} value={r.primer_apellido} onChange={(e) => updateRep(ri, { primer_apellido: e.target.value })} /></Field>
                      <Field label="2do apellido"><Input className={fieldCls} value={r.segundo_apellido} onChange={(e) => updateRep(ri, { segundo_apellido: e.target.value })} /></Field>
                      <Field label="Cédula"><Input className={fieldCls} value={r.cedula} onChange={(e) => updateRep(ri, { cedula: e.target.value })} placeholder="(sin cédula)" /></Field>
                      <Field label="Email">
                        <Input className={`${fieldCls} ${emailBad ? "border-red-400" : ""}`} value={r.email} onChange={(e) => updateRep(ri, { email: e.target.value })} />
                      </Field>
                      <Field label="Teléfono"><Input className={fieldCls} value={r.telefono} onChange={(e) => updateRep(ri, { telefono: e.target.value })} /></Field>
                      <Field label="Dirección"><Input className={fieldCls} value={r.direccion} onChange={(e) => updateRep(ri, { direccion: e.target.value })} /></Field>
                    </div>

                    <Separator className="my-3" />
                    <p className="text-xs font-medium text-muted-foreground mb-2">Hijos ({r.hijos.length})</p>
                    <div className="space-y-2">
                      {r.hijos.map((c, ci) => (
                        <div key={ci} className="grid grid-cols-2 md:grid-cols-6 gap-2 rounded bg-muted/40 p-2">
                          <Field label="1er nombre"><Input className={fieldCls} value={c.primer_nombre} onChange={(e) => updateChild(ri, ci, { primer_nombre: e.target.value })} /></Field>
                          <Field label="2do nombre"><Input className={fieldCls} value={c.segundo_nombre} onChange={(e) => updateChild(ri, ci, { segundo_nombre: e.target.value })} /></Field>
                          <Field label="1er apellido"><Input className={fieldCls} value={c.primer_apellido} onChange={(e) => updateChild(ri, ci, { primer_apellido: e.target.value })} /></Field>
                          <Field label="2do apellido"><Input className={fieldCls} value={c.segundo_apellido} onChange={(e) => updateChild(ri, ci, { segundo_apellido: e.target.value })} /></Field>
                          <Field label="Documento"><Input className={fieldCls} value={c.document_id ?? ""} onChange={(e) => updateChild(ri, ci, { document_id: e.target.value || null })} /></Field>
                          <Field label="Género">
                            <Select value={c.genero} onValueChange={(v) => updateChild(ri, ci, { genero: v })}>
                              <SelectTrigger className={fieldCls}><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{GENERO_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field label="Nacimiento">
                            <Input type="date" className={`${fieldCls} ${!c._origFecha ? "border-orange-400" : ""}`} value={c.fecha_nacimiento} onChange={(e) => updateChild(ri, ci, { fecha_nacimiento: e.target.value })} />
                          </Field>
                          <Field label="Grado">
                            <Select value={c.nivel_grado} onValueChange={(v) => updateChild(ri, ci, { nivel_grado: v })}>
                              <SelectTrigger className={`${fieldCls} ${!GRADE_OPTIONS.includes(c.nivel_grado) ? "border-orange-400" : ""}`}><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{GRADE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Teachers */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Docentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.map((d, di) => {
                const emailBad = !EMAIL_RE.test(d.email);
                return (
                  <div key={di} className="grid grid-cols-2 md:grid-cols-7 gap-2 rounded border p-2">
                    <Field label="1er nombre"><Input className={fieldCls} value={d.primer_nombre} onChange={(e) => updateDoc(di, { primer_nombre: e.target.value })} /></Field>
                    <Field label="2do nombre"><Input className={fieldCls} value={d.segundo_nombre} onChange={(e) => updateDoc(di, { segundo_nombre: e.target.value })} /></Field>
                    <Field label="1er apellido"><Input className={fieldCls} value={d.primer_apellido} onChange={(e) => updateDoc(di, { primer_apellido: e.target.value })} /></Field>
                    <Field label="2do apellido"><Input className={fieldCls} value={d.segundo_apellido} onChange={(e) => updateDoc(di, { segundo_apellido: e.target.value })} /></Field>
                    <Field label="Cédula"><Input className={fieldCls} value={d.cedula} onChange={(e) => updateDoc(di, { cedula: e.target.value })} /></Field>
                    <Field label="Email"><Input className={`${fieldCls} ${emailBad ? "border-red-400" : ""}`} value={d.email} onChange={(e) => updateDoc(di, { email: e.target.value })} /></Field>
                    <Field label="Área asignada">
                      <div className="flex flex-col gap-1">
                        <Input className={fieldCls} value={d.area_asignada} onChange={(e) => updateDoc(di, { area_asignada: e.target.value })} />
                        <Badge variant={d.create_area ? "default" : "secondary"} className="text-[10px] cursor-pointer w-fit" onClick={() => updateDoc(di, { create_area: !d.create_area })}>
                          {d.create_area ? "Crea área + asignación" : "Solo docente (sin área)"}
                        </Badge>
                      </div>
                    </Field>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 mb-10">
            <Button onClick={handleImport} disabled={importing || !schoolId} size="lg">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : <><Upload className="h-4 w-4 mr-2" /> Importar al colegio</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              No se envían correos. Contraseña de docentes y representantes = su cédula (los sin cédula reciben una aleatoria).
            </p>
          </div>
        </>
      )}

      {/* Report */}
      {report && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {report.error ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}
              Reporte de importación
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
                    <pre className="text-[11px] bg-red-50 text-red-800 p-3 rounded max-h-64 overflow-auto">{report.failed.join("\n")}</pre>
                  </div>
                )}
                {Array.isArray(report.created) && (
                  <details>
                    <summary className="text-sm cursor-pointer">Creados ({report.created.length})</summary>
                    <pre className="text-[11px] bg-muted p-3 rounded max-h-64 overflow-auto mt-1">{report.created.join("\n")}</pre>
                  </details>
                )}
                {Array.isArray(report.skipped) && report.skipped.length > 0 && (
                  <details>
                    <summary className="text-sm cursor-pointer">Omitidos / ya existían ({report.skipped.length})</summary>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
