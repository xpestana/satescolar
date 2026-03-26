import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { buildAttendanceScanUrl } from "@/lib/attendance-url";

// CR80 card dimensions in mm
const CARD_W_MM = 54;
const CARD_H_MM = 85.6;

export default function TeacherCarnet() {
  const { teacher, school, schoolId } = useTeacherData();
  const { data: carnetConfig } = useCarnetConfig(schoolId);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // Get school location
  const { data: schoolFull } = useQuery({
    queryKey: ["school-full", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("*, cities:city_id(name), states:state_id(name)")
        .eq("id", schoolId!)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Get active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("year_range")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const teacherName = teacher?.form_data
    ? `${(teacher.form_data as any).primer_nombre || ""} ${(teacher.form_data as any).segundo_nombre || ""} ${(teacher.form_data as any).primer_apellido || ""} ${(teacher.form_data as any).segundo_apellido || ""}`.replace(/\s+/g, " ").trim()
    : "Docente";

  const documentId = teacher?.document_id || (teacher?.form_data as any)?.documento || "";

  const generatePDF = async () => {
    if (!teacher || !carnetConfig) {
      toast({ title: "Error", description: "No se pudo cargar la configuración del carnet.", variant: "destructive" });
      return;
    }

    setGenerating(true);

    try {
      const layout = carnetConfig.layout_config as any;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [CARD_W_MM, CARD_H_MM] });

      const primaryColor = carnetConfig.primary_color || "#01051e";
      const secondaryColor = carnetConfig.secondary_color || "#1e78c8";

      const headerH = (layout.headerHeight / 342) * CARD_H_MM;
      const bottomBarH = (20 / 342) * CARD_H_MM;
      const bodyH = CARD_H_MM - headerH - bottomBarH;

      // Header background
      pdf.setFillColor(primaryColor);
      pdf.rect(0, 0, CARD_W_MM, headerH, "F");

      // Decorative triangles
      pdf.setFillColor(secondaryColor);
      const triH = headerH * 0.77;
      const triW = (40 / 216) * CARD_W_MM;
      pdf.triangle(0, 0, triW, 0, 0, triH, "F");

      // Bottom accent line
      const lineH = (1 / 342) * CARD_H_MM;
      pdf.setFillColor(secondaryColor);
      pdf.rect(0, headerH - lineH, CARD_W_MM, lineH, "F");

      // School name in header
      const schoolNameFs = (layout.fontSizes?.schoolName || 8) * (CARD_W_MM / 216);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(schoolNameFs * 2.83);
      pdf.setTextColor("#ffffff");
      const snX = (layout.schoolNamePos?.x / 100) * CARD_W_MM;
      const snY = (layout.schoolNamePos?.y / 100) * headerH;
      pdf.text((school?.name || "").toUpperCase(), snX, snY, { align: "center" });

      // City
      const cityName = (schoolFull as any)?.cities?.name || "";
      const stateName = (schoolFull as any)?.states?.name || "";
      const location = [cityName, stateName].filter(Boolean).join(", ");
      if (location) {
        pdf.setFontSize(6 * (CARD_W_MM / 216) * 2.83);
        pdf.setTextColor(255, 255, 255, 0.8 * 255);
        const cX = (layout.cityPos?.x / 100) * CARD_W_MM;
        const cY = (layout.cityPos?.y / 100) * headerH;
        pdf.text(location, cX, cY, { align: "center" });
      }

      // Year
      if (activeYear?.year_range) {
        pdf.setFontSize(6 * (CARD_W_MM / 216) * 2.83);
        const yX = (layout.yearPos?.x / 100) * CARD_W_MM;
        const yY = (layout.yearPos?.y / 100) * headerH;
        pdf.text(`Año Escolar: ${activeYear.year_range}`, yX, yY, { align: "center" });
      }

      // Logo
      if (school?.logo_url) {
        try {
          const logoSize = (layout.logoSize || 30) * (CARD_W_MM / 216);
          const lX = ((layout.logoPos?.x || 50) / 100) * CARD_W_MM - logoSize / 2;
          const lY = ((layout.logoPos?.y || 50) / 100) * headerH - logoSize / 2;
          pdf.addImage(school.logo_url, "PNG", lX, lY, logoSize, logoSize);
        } catch { /* skip logo on error */ }
      }

      // Body - white
      pdf.setFillColor("#ffffff");
      pdf.rect(0, headerH, CARD_W_MM, bodyH, "F");

      // Watermark
      if (school?.logo_url) {
        try {
          const wmSize = ((carnetConfig.watermark_size || 30) / 54) * CARD_W_MM;
          const wmX = CARD_W_MM / 2 - wmSize / 2;
          const wmY = headerH + bodyH / 2 - wmSize / 2;
          // Can't do opacity in jspdf easily, skip or add with GState
          pdf.addImage(school.logo_url, "PNG", wmX, wmY, wmSize, wmSize);
        } catch { /* skip */ }
      }

      // Photo
      if (teacher.photo_url) {
        try {
          const photoSize = (layout.photoSize || 56) * (CARD_W_MM / 216);
          const pX = ((layout.photoPos?.x || 50) / 100) * CARD_W_MM - photoSize / 2;
          const pY = headerH + ((layout.photoPos?.y || 15) / 100) * bodyH - photoSize / 2;
          pdf.addImage(teacher.photo_url, "JPEG", pX, pY, photoSize, photoSize);
        } catch { /* skip */ }
      }

      // Teacher Name
      const nameFs = (layout.fontSizes?.studentName || 9) * (CARD_W_MM / 216);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(nameFs * 2.83);
      pdf.setTextColor(primaryColor);
      const nX = ((layout.namePos?.x || 50) / 100) * CARD_W_MM;
      const nY = headerH + ((layout.namePos?.y || 52) / 100) * bodyH;
      pdf.text(teacherName.toUpperCase(), nX, nY, { align: "center" });

      // Badge - DOCENTE
      const bX = ((layout.badgePos?.x || 50) / 100) * CARD_W_MM;
      const bY = headerH + ((layout.badgePos?.y || 62) / 100) * bodyH;
      const badgeW = 18;
      const badgeH = 4;
      pdf.setFillColor(secondaryColor);
      pdf.roundedRect(bX - badgeW / 2, bY - badgeH / 2, badgeW, badgeH, 2, 2, "F");
      pdf.setFontSize(8 * (CARD_W_MM / 216) * 2.83);
      pdf.setTextColor("#ffffff");
      pdf.setFont("helvetica", "bold");
      pdf.text("DOCENTE", bX, bY + 1, { align: "center" });

      // Document ID
      if (documentId) {
        const docFs = (layout.fontSizes?.document || 8) * (CARD_W_MM / 216);
        pdf.setFontSize(docFs * 2.83);
        pdf.setTextColor(primaryColor);
        const dX = ((layout.docPos?.x || 50) / 100) * CARD_W_MM;
        const dY = headerH + ((layout.docPos?.y || 72) / 100) * bodyH;
        pdf.text(documentId, dX, dY, { align: "center" });
      }

      // QR Code - use attendance token URL
      try {
        // Fetch attendance token for this teacher
        let qrData = `DOCENTE|${teacherName}|${documentId}|${school?.name || ""}`;
        const { data: tokenData } = await supabase
          .from("attendance_tokens")
          .select("token")
          .eq("entity_type", "teacher")
          .eq("entity_id", teacher.id)
          .maybeSingle();
        if (tokenData?.token) {
          qrData = buildAttendanceScanUrl(tokenData.token);
        }
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
        const qrSize = (layout.qrSize || 28) * (CARD_W_MM / 216);
        const qX = ((layout.qrPos?.x || 50) / 100) * CARD_W_MM - qrSize / 2;
        const qY = headerH + ((layout.qrPos?.y || 85) / 100) * bodyH - qrSize / 2;
        pdf.addImage(qrDataUrl, "PNG", qX, qY, qrSize, qrSize);
      } catch { /* skip */ }

      // Bottom bar
      pdf.setFillColor(primaryColor);
      pdf.rect(0, CARD_H_MM - bottomBarH, CARD_W_MM, bottomBarH, "F");
      pdf.setFontSize(5 * (CARD_W_MM / 216) * 2.83);
      pdf.setTextColor("#ffffff");
      pdf.text("https://satescolar.com", CARD_W_MM / 2, CARD_H_MM - bottomBarH / 2 + 0.5, { align: "center" });

      pdf.save(`carnet-docente-${teacherName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast({ title: "Carnet generado", description: "El PDF se descargó correctamente." });
    } catch (err) {
      console.error("Error generating carnet:", err);
      toast({ title: "Error", description: "No se pudo generar el carnet.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const hasConfig = !!carnetConfig;

  return (
    <DashboardLayout>
      <PageHeader title="Mi Carnet" breadcrumbs={[{ label: "Inicio", href: "/teacher/dashboard" }, { label: "Mi Carnet" }]} />

      <div className="max-w-lg">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{teacherName}</h3>
                {documentId && <p className="text-sm text-muted-foreground">{documentId}</p>}
                <p className="text-sm text-muted-foreground">{school?.name || ""}</p>
              </div>
            </div>

            {!hasConfig ? (
              <p className="text-sm text-muted-foreground">
                El colegio aún no ha configurado el diseño del carnet. Contacta al administrador.
              </p>
            ) : (
              <Button onClick={generatePDF} disabled={generating} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                {generating ? "Generando..." : "Descargar Carnet en PDF"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
