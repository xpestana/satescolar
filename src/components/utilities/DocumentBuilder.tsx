import { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, Save, FileDown, Eye, Plus, Trash2, User, GraduationCap,
  Home, UserCheck, Calendar, Info, Loader2, FileText, X,
} from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { addArialFont } from "@/lib/pdf-fonts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Snippet definitions ─────────────────────────────────────────────
interface SnippetDef { key: string; label: string; }

const SNIPPET_GROUPS: { group: string; icon: any; snippets: SnippetDef[] }[] = [
  {
    group: "Estudiante", icon: User,
    snippets: [
      { key: "primer_nombre", label: "Primer Nombre" },
      { key: "segundo_nombre", label: "Segundo Nombre" },
      { key: "primer_apellido", label: "Primer Apellido" },
      { key: "segundo_apellido", label: "Segundo Apellido" },
      { key: "nombre_completo", label: "Nombre Completo" },
      { key: "documento", label: "Documento" },
      { key: "fecha_nacimiento", label: "Fecha Nacimiento" },
      { key: "ciudad_nacimiento", label: "Ciudad Nacimiento" },
      { key: "email", label: "Correo" },
      { key: "numero_contacto", label: "Teléfono" },
    ],
  },
  {
    group: "Inscripción", icon: GraduationCap,
    snippets: [
      { key: "grado", label: "Grado / Nivel" },
      { key: "seccion", label: "Sección" },
      { key: "tipo_de_estudiante", label: "Tipo Estudiante" },
      { key: "fecha_de_inscripcion", label: "Fecha Inscripción" },
      { key: "año_escolar", label: "Año Escolar" },
    ],
  },
  {
    group: "Familia", icon: Home,
    snippets: [
      { key: "apellido_paterno", label: "Apellido Paterno" },
      { key: "apellido_materno", label: "Apellido Materno" },
      { key: "telefono_familia", label: "Teléfono" },
      { key: "direccion", label: "Dirección" },
    ],
  },
  {
    group: "Representante", icon: UserCheck,
    snippets: [
      { key: "rep_nombre_completo", label: "Nombre Completo" },
      { key: "rep_documento", label: "Documento" },
      { key: "rep_telefono", label: "Teléfono" },
    ],
  },
  {
    group: "Sistema", icon: Calendar,
    snippets: [
      { key: "fecha_actual", label: "Fecha Actual" },
      { key: "nombre_colegio", label: "Nombre Colegio" },
    ],
  },
];

const GRADE_LABELS: Record<string, string> = {
  pre_1: "Preescolar 1er Nivel", pre_2: "Preescolar 2do Nivel", pre_3: "Preescolar 3er Nivel",
  "1": "1er Grado", "2": "2do Grado", "3": "3er Grado",
  "4": "4to Grado", "5": "5to Grado", "6": "6to Grado",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};

function resolveSnippets(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

// ── Component ────────────────────────────────────────────────────────
export function DocumentBuilder() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const queryClient = useQueryClient();
  const savedSelectionRef = useRef<Range | null>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const editor = document.querySelector("[contenteditable]") as HTMLDivElement;
      if (editor && editor.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  }, []);

  const editorCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.addEventListener("keyup", saveSelection);
      node.addEventListener("mouseup", saveSelection);
      node.addEventListener("focus", saveSelection);
    }
  }, [saveSelection]);

  const [content, setContent] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [docSignatureLines, setDocSignatureLines] = useState<string[]>(["Firma del Representante", "Firma del Director(a)"]);
  const [newSignatureLine, setNewSignatureLine] = useState("");

  // ── Queries ─────────────────────────────────────────────────────
  const { data: templates } = useQuery({
    queryKey: ["document-templates", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_templates")
        .select("*")
        .eq("school_id", schoolId!)
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: planillaConfig } = useQuery({
    queryKey: ["planilla-config-doc-builder", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("planilla_general_config" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  const { data: schoolFull } = useQuery({
    queryKey: ["school-full-doc-builder", schoolId],
    queryFn: async () => {
      const { data: s } = await supabase
        .from("schools")
        .select("*")
        .eq("id", schoolId!)
        .single();
      if (!s) return null;
      const [stateR, muniR, cityR, parishR] = await Promise.all([
        s.state_id ? supabase.from("states").select("name").eq("id", s.state_id).single() : null,
        s.municipality_id ? supabase.from("municipalities").select("name").eq("id", s.municipality_id).single() : null,
        s.city_id ? supabase.from("cities").select("name").eq("id", s.city_id).single() : null,
        s.parish_id ? supabase.from("parishes").select("name").eq("id", s.parish_id).single() : null,
      ]);
      return {
        ...s,
        geo: {
          state: stateR?.data?.name || "",
          municipality: muniR?.data?.name || "",
          city: cityR?.data?.name || "",
          parish: parishR?.data?.name || "",
        },
      };
    },
    enabled: !!schoolId,
  });

  const { data: students } = useQuery({
    queryKey: ["doc-builder-students", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_schools")
        .select(`student_id, students!inner(id, document_id, form_data, photo_url, families!inner(id, father_last_name, mother_last_name, contact_phone, address, user_id, representatives(id, document_id, phone, form_data, is_primary)))`)
        .eq("school_id", schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: studentEnrollment } = useQuery({
    queryKey: ["doc-builder-enrollment", selectedStudentId, schoolId],
    queryFn: async () => {
      const { data: activeYear } = await supabase
        .from("school_years").select("id, year_range").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      if (!activeYear || !selectedStudentId) return null;
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select(`id, enrollment_type, enrollment_date, observations, sections!inner(id, name, grade_level), school_years!inner(year_range)`)
        .eq("student_id", selectedStudentId).eq("school_year_id", activeYear.id).maybeSingle();
      return enrollment;
    },
    enabled: !!selectedStudentId && !!schoolId,
  });

  // ── Derived data ────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!students || !studentSearch.trim()) return [];
    const q = studentSearch.toLowerCase();
    return students.filter((ss) => {
      const s = ss.students as any;
      const fd = (s.form_data || {}) as Record<string, any>;
      const fullName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ").toLowerCase();
      return fullName.includes(q) || (s.document_id || "").toLowerCase().includes(q);
    }).slice(0, 10);
  }, [students, studentSearch]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId || !students) return null;
    return students.find((ss) => (ss.students as any).id === selectedStudentId);
  }, [selectedStudentId, students]);

  const signatureLines: string[] = docSignatureLines;

  const snippetData = useMemo((): Record<string, string> => {
    const d: Record<string, string> = {
      fecha_actual: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
      nombre_colegio: school?.name || "",
    };
    if (!selectedStudent) return d;
    const s = selectedStudent.students as any;
    const fd = (s.form_data || {}) as Record<string, any>;
    const fam = s.families as any;
    const primaryRep = fam?.representatives?.find((r: any) => r.is_primary) || fam?.representatives?.[0];
    const repFd = (primaryRep?.form_data || {}) as Record<string, any>;

    d.primer_nombre = fd.primer_nombre || "";
    d.segundo_nombre = fd.segundo_nombre || "";
    d.primer_apellido = fd.primer_apellido || "";
    d.segundo_apellido = fd.segundo_apellido || "";
    d.nombre_completo = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ");
    d.documento = s.document_id || "";
    d.fecha_nacimiento = fd.fecha_nacimiento ? format(new Date(fd.fecha_nacimiento), "dd/MM/yyyy") : "";
    d.ciudad_nacimiento = fd.ciudad_nacimiento || "";
    d.email = fd.email || "";
    d.numero_contacto = fd.numero_contacto || "";

    if (studentEnrollment) {
      const sec = studentEnrollment.sections as any;
      d.grado = GRADE_LABELS[sec?.grade_level] || sec?.grade_level || "";
      d.seccion = sec?.name || "";
      d.tipo_de_estudiante = studentEnrollment.enrollment_type || "";
      d.fecha_de_inscripcion = studentEnrollment.enrollment_date ? format(new Date(studentEnrollment.enrollment_date), "dd/MM/yyyy") : "";
      d.año_escolar = (studentEnrollment.school_years as any)?.year_range || "";
    }

    d.apellido_paterno = fam?.father_last_name || "";
    d.apellido_materno = fam?.mother_last_name || "";
    d.telefono_familia = fam?.contact_phone || "";
    d.direccion = fam?.address || "";

    if (primaryRep) {
      d.rep_nombre_completo = [repFd.primer_nombre, repFd.segundo_nombre, repFd.primer_apellido, repFd.segundo_apellido].filter(Boolean).join(" ");
      d.rep_documento = primaryRep.document_id || "";
      d.rep_telefono = primaryRep.phone || repFd.numero_contacto || "";
    }
    return d;
  }, [selectedStudent, studentEnrollment, school]);

  // ── Header/Footer HTML builders ─────────────────────────────────
  const headerHtml = useMemo(() => {
    const hc = planillaConfig?.header_config || {};
    const s = schoolFull;
    if (!s) return `<div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:16px;">${school?.name || ""}</div>`;

    const parts: string[] = [];
    
    // Logo + School name + codes
    let logoHtml = "";
    if (hc.show_logo !== false && s.logo_url) {
      logoHtml = `<img src="${s.logo_url}" style="width:50px;height:50px;object-fit:contain;" crossorigin="anonymous" />`;
    }

    let centerParts: string[] = [];
    if (hc.show_name !== false) centerParts.push(`<div style="font-weight:bold;font-size:14px;">${s.name}</div>`);
    
    const codeParts: string[] = [];
    if (hc.show_dea_code !== false && s.dea_code) codeParts.push(`Código DEA: ${s.dea_code}`);
    if (hc.show_statistical_code !== false && s.statistical_code) codeParts.push(`Código Estadístico: ${s.statistical_code}`);
    if (codeParts.length) centerParts.push(`<div style="font-size:9px;color:#666;">${codeParts.join(" - ")}</div>`);

    if (hc.show_address !== false && s.address) {
      const addrParts = [s.address];
      if (s.geo.parish) addrParts.push(`parroquia ${s.geo.parish}`);
      if (s.geo.municipality) addrParts.push(`municipio ${s.geo.municipality}`);
      if (s.geo.city) addrParts.push(s.geo.city);
      if (s.geo.state) addrParts.push(s.geo.state);
      centerParts.push(`<div style="font-size:9px;color:#666;">${addrParts.join(", ")}</div>`);
    }

    const infoParts: string[] = [];
    if (hc.show_phone !== false && s.phone) infoParts.push(`Tel: ${s.phone}`);
    if (hc.show_rif !== false && s.rif) infoParts.push(`Rif: ${s.rif}`);
    if (infoParts.length) centerParts.push(`<div style="font-size:9px;color:#666;">${infoParts.join(" - ")}</div>`);

    return `
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;">
        ${logoHtml ? `<div>${logoHtml}</div>` : ""}
        <div style="text-align:center;">${centerParts.join("")}</div>
      </div>
      <hr style="border:none;border-top:1px solid #ddd;margin:8px 0 16px;" />
    `;
  }, [planillaConfig, schoolFull, school]);

  const footerHtml = useMemo(() => {
    const fc = planillaConfig?.footer_config || {};
    const s = schoolFull;
    const parts: string[] = [];
    
    if (fc.show_address !== false && s?.address) {
      const addrParts = [s.address];
      if (s.geo.parish) addrParts.push(`Parroquia ${s.geo.parish}`);
      if (s.geo.municipality) addrParts.push(`Municipio ${s.geo.municipality}`);
      if (s.geo.city) addrParts.push(s.geo.city);
      if (s.geo.state) addrParts.push(s.geo.state);
      parts.push(addrParts.join(", "));
    }
    if (fc.show_phone !== false && s?.phone) parts.push(`Tel: ${s.phone}`);
    if (fc.show_rif !== false && s?.rif) parts.push(`Rif: ${s.rif}`);

    return `
      <div style="text-align:center;font-size:8px;color:#888;border-top:1px solid #ddd;padding-top:8px;margin-top:8px;">
        ${parts.length ? `<div>${parts.join(" ")}</div>` : ""}
      </div>
    `;
  }, [planillaConfig, schoolFull]);

  const signaturesHtml = useMemo(() => {
    if (!signatureLines.length) return "";
    const cols = signatureLines.map(label => `
      <div style="flex:1;text-align:center;">
        <div style="border-top:1px solid #000;width:80%;margin:0 auto;"></div>
        <div style="font-size:10px;margin-top:4px;">${label}</div>
      </div>
    `).join("");
    return `<div style="display:flex;justify-content:center;gap:32px;margin-top:60px;margin-bottom:16px;">${cols}</div>`;
  }, [signatureLines]);

  // ── Mutations ───────────────────────────────────────────────────
  const saveTemplate = useMutation({
    mutationFn: async (name: string) => {
      if (selectedTemplateId) {
        const { error } = await supabase.from("document_templates").update({ name, content_html: content, signature_lines: docSignatureLines } as any).eq("id", selectedTemplateId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_templates").insert({ school_id: schoolId!, name, content_html: content, signature_lines: docSignatureLines } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Plantilla guardada");
      setShowSaveDialog(false);
    },
    onError: () => toast.error("Error al guardar la plantilla"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      setSelectedTemplateId("");
      setContent("");
      toast.success("Plantilla eliminada");
    },
  });

  // ── Handlers ────────────────────────────────────────────────────
  const insertSnippet = useCallback((key: string) => {
    const editor = document.querySelector("[contenteditable]") as HTMLDivElement;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    const snippet = `{{${key}}} `;
    document.execCommand("insertHTML", false, snippet);
    setTimeout(saveSelection, 0);
  }, [saveSelection]);

  const loadTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    if (tpl) {
      setContent(tpl.content_html);
      setTemplateName(tpl.name);
      const sigs = (tpl as any).signature_lines;
      if (Array.isArray(sigs)) setDocSignatureLines(sigs);
    }
  }, [templates]);

  const handleSave = useCallback(() => {
    if (!content.trim()) { toast.error("El documento está vacío"); return; }
    if (selectedTemplateId) {
      const tpl = templates?.find((t) => t.id === selectedTemplateId);
      setTemplateName(tpl?.name || "");
    } else {
      setTemplateName("");
    }
    setShowSaveDialog(true);
  }, [content, selectedTemplateId, templates]);

  const handleGeneratePDF = useCallback(async () => {
    if (!content.trim()) { toast.error("El documento está vacío"); return; }
    setGenerating(true);
    try {
      const resolved = resolveSnippets(content, snippetData);

      // Create offscreen container for html2canvas
      const container = document.createElement("div");
      container.style.cssText = "position:absolute;left:-9999px;top:0;width:680px;background:#fff;padding:40px;font-family:Arial,Helvetica,sans-serif;color:#000;line-height:1.6;font-size:12px;";
      
      container.innerHTML = `
        ${headerHtml}
        <div style="min-height:500px;">${resolved}</div>
        ${signaturesHtml}
        ${footerHtml}
      `;
      document.body.appendChild(container);

      // Wait for images to load
      const images = container.querySelectorAll("img");
      await Promise.all(Array.from(images).map(img =>
        img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
      ));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      document.body.removeChild(container);

      // Create PDF from canvas
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      
      const imgData = canvas.toDataURL("image/png");
      const imgW = usableW;
      const imgH = (canvas.height * imgW) / canvas.width;
      
      let heightLeft = imgH;
      let position = margin;
      
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgH - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }

      const studentName = snippetData.nombre_completo || "documento";
      pdf.save(`${studentName.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF generado exitosamente");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setGenerating(false);
    }
  }, [content, snippetData, headerHtml, signaturesHtml, footerHtml]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
        <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">¿Cómo usar el Constructor de Planillas?</span></p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Escribe tu documento en el editor o carga una <strong>plantilla guardada</strong>.</li>
            <li>Usa los botones de <strong>variables</strong> para insertar datos automáticos (ej: nombre, cédula, grado).</li>
            <li>Busca y selecciona un <strong>estudiante</strong> para ver los datos reales en la previsualización.</li>
            <li><strong>Guarda como plantilla</strong> para reutilizar el documento con otros estudiantes.</li>
            <li>Haz clic en <strong>Descargar PDF</strong> para generar el documento final con header, firmas y footer.</li>
          </ol>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Las variables como <code className="bg-muted px-1 rounded text-xs">{"{{primer_nombre}}"}</code> se reemplazan automáticamente con los datos del estudiante seleccionado.
            El header y footer se toman de la configuración en <strong>Ajustes → Planillas</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Templates */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Plantillas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              <Select value={selectedTemplateId} onValueChange={loadTemplate}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleSave}>
                  <Save className="h-3 w-3 mr-1" /> Guardar
                </Button>
                {selectedTemplateId && (
                  <Button size="sm" variant="outline" className="text-xs text-destructive hover:text-destructive" onClick={() => deleteTemplate.mutate(selectedTemplateId)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                  setSelectedTemplateId(""); setContent(""); setTemplateName("");
                  setDocSignatureLines(["Firma del Representante", "Firma del Director(a)"]);
                }}>
                  <Plus className="h-3 w-3 mr-1" /> Nuevo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Student search */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4" /> Buscar Estudiante
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              <Input placeholder="Nombre o cédula..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="text-sm" />
              {selectedStudent && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-xs">
                  <User className="h-3 w-3 text-primary" />
                  <span className="font-medium truncate flex-1">{snippetData.nombre_completo}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => { setSelectedStudentId(null); setStudentSearch(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {studentSearch.trim() && !selectedStudentId && (
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {filteredStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">Sin resultados</p>
                    ) : filteredStudents.map((ss) => {
                      const s = ss.students as any;
                      const fd = (s.form_data || {}) as Record<string, any>;
                      const name = [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ");
                      return (
                        <button key={s.id} className="w-full text-left p-2 hover:bg-accent rounded-sm text-xs transition-colors" onClick={() => { setSelectedStudentId(s.id); setStudentSearch(""); }}>
                          <p className="font-medium">{name}</p>
                          <p className="text-muted-foreground">{s.document_id || "Sin documento"}</p>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Snippet buttons */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Variables disponibles</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {SNIPPET_GROUPS.map(({ group, icon: Icon, snippets }) => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Icon className="h-3 w-3" /> {group}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {snippets.map((sn) => (
                          <Badge key={sn.key} variant="outline" className="cursor-pointer hover:bg-primary/10 hover:border-primary text-[10px] px-1.5 py-0.5 transition-colors select-none"
                            onMouseDown={(e) => { e.preventDefault(); insertSnippet(sn.key); }}>
                            {sn.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main: Editor + Actions */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} disabled={!content.trim()}>
              <Eye className="h-4 w-4 mr-1" /> Previsualizar
            </Button>
            <Button size="sm" onClick={handleGeneratePDF} disabled={generating || !content.trim()}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
              Descargar PDF
            </Button>
          </div>

          <RichTextEditor value={content} onChange={setContent} placeholder="Escribe el contenido de tu planilla aquí... Usa las variables del panel izquierdo para insertar datos automáticos." minHeight={400} />

          {/* Signature lines config */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Líneas de Firma (obligatorio)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {docSignatureLines.map((sig, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input value={sig} onChange={(e) => setDocSignatureLines(prev => prev.map((s, i) => i === idx ? e.target.value : s))} className="text-sm flex-1" />
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => setDocSignatureLines(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newSignatureLine} onChange={(e) => setNewSignatureLine(e.target.value)} placeholder="Ej: Firma del Secretario" className="text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = newSignatureLine.trim(); if (v) { setDocSignatureLines(prev => [...prev, v]); setNewSignatureLine(""); } } }} />
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { const v = newSignatureLine.trim(); if (v) { setDocSignatureLines(prev => [...prev, v]); setNewSignatureLine(""); } }}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar Plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre de la plantilla</label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ej: Constancia de Estudios" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveTemplate.mutate(templateName)} disabled={!templateName.trim() || saveTemplate.isPending}>
              {saveTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog — full document with header, content, signatures, footer */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Previsualización del Documento</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div ref={pdfContentRef} className="p-8 bg-white border rounded-md text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.6, fontSize: "13.3px" }}>
              {/* Header from planilla config */}
              <div dangerouslySetInnerHTML={{ __html: headerHtml }} />

              {/* Content with resolved snippets */}
              <div
                className="max-w-none"
                style={{ color: "#000", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13.3px", lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: resolveSnippets(content, snippetData) }}
              />

              {/* Signature area */}
              <div dangerouslySetInnerHTML={{ __html: signaturesHtml }} />

              {/* Footer from planilla config */}
              <div dangerouslySetInnerHTML={{ __html: footerHtml }} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
