export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  compatibleTypes: string[];
}

export const preschoolTemplates: ReportTemplate[] = [
  { id: "classic", name: "Clásica", description: "Diseño tradicional con encabezado y componentes", compatibleTypes: ["descriptive", "indicators"] },
  { id: "colorful", name: "Colorida", description: "Colores vibrantes y secciones diferenciadas", compatibleTypes: ["descriptive", "indicators"] },
  { id: "minimal", name: "Minimalista", description: "Limpia y simple, solo lo esencial", compatibleTypes: ["descriptive", "indicators"] },
];

export const primaryTemplates: ReportTemplate[] = [
  { id: "classic", name: "Clásica", description: "Tabla de áreas con calificaciones", compatibleTypes: ["descriptive", "indicators"] },
  { id: "detailed", name: "Detallada", description: "Incluye observaciones extensas por área", compatibleTypes: ["descriptive", "indicators"] },
  { id: "compact", name: "Compacta", description: "Todo en una sola página, formato reducido", compatibleTypes: ["descriptive", "indicators"] },
];

export const secondaryTemplates: ReportTemplate[] = [
  { id: "classic", name: "Clásica", description: "Formato estándar con notas por materia", compatibleTypes: ["all"] },
  { id: "formal", name: "Formal", description: "Estilo institucional con escudo y firmas", compatibleTypes: ["all"] },
  { id: "modern", name: "Moderna", description: "Diseño contemporáneo con gráficos", compatibleTypes: ["all"] },
];
