import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  EyeOff, 
  GripVertical,
  Type,
  Mail,
  Phone,
  Hash,
  Calendar,
  List,
  FileText,
  CheckSquare,
  Upload,
  ArrowLeft,
  FolderOpen
} from "lucide-react";
import { FormGroupsManager } from "@/components/forms/FormGroupsManager";

type FormType = "representative" | "student" | "teacher";
type FieldType = "text" | "email" | "phone" | "number" | "date" | "select" | "textarea" | "checkbox" | "file";

interface FormField {
  id: string;
  school_id: string;
  form_type: FormType;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  placeholder: string | null;
  is_required: boolean;
  is_visible: boolean;
  field_order: number;
  options: string[] | null;
  group_id: string | null;
}

interface FormFieldGroup {
  id: string;
  school_id: string;
  form_type: FormType;
  name: string;
  description: string | null;
  display_order: number;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; icon: React.ElementType }[] = [
  { value: "text", label: "Texto", icon: Type },
  { value: "email", label: "Correo electrónico", icon: Mail },
  { value: "phone", label: "Teléfono", icon: Phone },
  { value: "number", label: "Número", icon: Hash },
  { value: "date", label: "Fecha", icon: Calendar },
  { value: "select", label: "Lista de opciones", icon: List },
  { value: "textarea", label: "Texto largo", icon: FileText },
  { value: "checkbox", label: "Casilla de verificación", icon: CheckSquare },
  { value: "file", label: "Archivo", icon: Upload },
];

const PREDEFINED_FIELDS: { [key in FormType]: { name: string; label: string; type: FieldType }[] } = {
  representative: [
    { name: "nombres", label: "Nombres", type: "text" },
    { name: "apellidos", label: "Apellidos", type: "text" },
    { name: "cedula", label: "Cédula de Identidad", type: "text" },
    { name: "telefono", label: "Teléfono", type: "phone" },
    { name: "email", label: "Correo Electrónico", type: "email" },
    { name: "direccion", label: "Dirección", type: "textarea" },
    { name: "fecha_nacimiento", label: "Fecha de Nacimiento", type: "date" },
    { name: "ocupacion", label: "Ocupación", type: "text" },
    { name: "lugar_trabajo", label: "Lugar de Trabajo", type: "text" },
    { name: "parentesco", label: "Parentesco con el Estudiante", type: "select" },
  ],
  student: [
    { name: "nombres", label: "Nombres", type: "text" },
    { name: "apellidos", label: "Apellidos", type: "text" },
    { name: "cedula_escolar", label: "Cédula Escolar", type: "text" },
    { name: "fecha_nacimiento", label: "Fecha de Nacimiento", type: "date" },
    { name: "lugar_nacimiento", label: "Lugar de Nacimiento", type: "text" },
    { name: "genero", label: "Género", type: "select" },
    { name: "direccion", label: "Dirección", type: "textarea" },
    { name: "alergias", label: "Alergias", type: "textarea" },
    { name: "condiciones_medicas", label: "Condiciones Médicas", type: "textarea" },
    { name: "grupo_sanguineo", label: "Grupo Sanguíneo", type: "select" },
  ],
  teacher: [
    { name: "nombres", label: "Nombres", type: "text" },
    { name: "apellidos", label: "Apellidos", type: "text" },
    { name: "cedula", label: "Cédula de Identidad", type: "text" },
    { name: "telefono", label: "Teléfono", type: "phone" },
    { name: "email", label: "Correo Electrónico", type: "email" },
    { name: "cargo", label: "Cargo", type: "text" },
    { name: "fecha_ingreso", label: "Fecha de Ingreso", type: "date" },
    { name: "titulo", label: "Título Obtenido", type: "text" },
  ],
};

export default function FormFieldsEditor() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId, isLoading: isLoadingSchool } = useSchoolId();
  
  // Map Spanish URLs to English form types
  const typeMapping: Record<string, FormType> = {
    "representantes": "representative",
    "representative": "representative",
    "estudiantes": "student",
    "student": "student",
    "docentes": "teacher",
    "teacher": "teacher",
  };
  
  const formType = typeMapping[type || ""] || null;
  const isValidType = formType === "representative" || formType === "student" || formType === "teacher";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [selectedPredefined, setSelectedPredefined] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Fetch form fields
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["form-fields", schoolId, formType],
    queryFn: async () => {
      if (!schoolId || !isValidType) return [];
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", formType)
        .order("field_order", { ascending: true });
      
      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!schoolId && isValidType,
  });

  // Fetch form field groups
  const { data: groups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, formType],
    queryFn: async () => {
      if (!schoolId || !isValidType) return [];
      const { data, error } = await supabase
        .from("form_field_groups")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", formType)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as FormFieldGroup[];
    },
    enabled: !!schoolId && isValidType,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (fieldData: Partial<FormField>) => {
      if (!schoolId) throw new Error("No school assigned");
      
      const maxOrder = fields.length > 0 
        ? Math.max(...fields.map(f => f.field_order)) + 1 
        : 0;
      
      const { error } = await supabase
        .from("form_fields")
        .insert({
          school_id: schoolId,
          form_type: formType,
          field_name: fieldData.field_name,
          field_label: fieldData.field_label,
          field_type: fieldData.field_type,
          placeholder: fieldData.placeholder || null,
          is_required: fieldData.is_required || false,
          field_order: maxOrder,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
      closeModal();
      toast({ title: "Campo creado", description: "El campo se agregó correctamente." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Ya existe un campo con ese nombre."
          : "No se pudo crear el campo.",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (fieldData: Partial<FormField> & { id: string }) => {
      const { id, ...updates } = fieldData;
      const { error } = await supabase
        .from("form_fields")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
      closeModal();
      toast({ title: "Campo actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el campo." });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
      setDeleteId(null);
      toast({ title: "Campo eliminado", description: "El campo se eliminó correctamente." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el campo." });
    },
  });

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase
        .from("form_fields")
        .update({ is_visible })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingField(null);
    setSelectedPredefined("");
    setFieldLabel("");
    setFieldName("");
    setFieldType("text");
    setPlaceholder("");
    setIsRequired(false);
    setSelectedGroupId(null);
  };

  const openCreateModal = () => {
    closeModal();
    setIsModalOpen(true);
  };

  const openEditModal = (field: FormField) => {
    setEditingField(field);
    setFieldLabel(field.field_label);
    setFieldName(field.field_name);
    setFieldType(field.field_type);
    setPlaceholder(field.placeholder || "");
    setIsRequired(field.is_required);
    setSelectedGroupId(field.group_id);
    setIsModalOpen(true);
  };

  const handlePredefinedChange = (value: string) => {
    setSelectedPredefined(value);
    const predefined = PREDEFINED_FIELDS[formType].find(p => p.name === value);
    if (predefined) {
      setFieldName(predefined.name);
      setFieldLabel(predefined.label);
      setFieldType(predefined.type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fieldLabel.trim() || !fieldName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre y la etiqueta son obligatorios." });
      return;
    }

    const fieldData = {
      field_name: fieldName.trim().toLowerCase().replace(/\s+/g, "_"),
      field_label: fieldLabel.trim(),
      field_type: fieldType,
      placeholder: placeholder.trim() || null,
      is_required: isRequired,
      group_id: selectedGroupId,
    };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, ...fieldData });
    } else {
      createMutation.mutate(fieldData);
    }
  };

  const getFieldTypeIcon = (type: FieldType) => {
    const option = FIELD_TYPE_OPTIONS.find(o => o.value === type);
    return option?.icon || Type;
  };

  const getFieldTypeLabel = (type: FieldType) => {
    const option = FIELD_TYPE_OPTIONS.find(o => o.value === type);
    return option?.label || type;
  };

  // Handle invalid type redirect with useEffect
  useEffect(() => {
    if (!isValidType) {
      navigate("/school/configuraciones/formularios");
    }
  }, [isValidType, navigate]);

  if (!isValidType) {
    return null;
  }

  const title = formType === "representative" 
    ? "Formulario de Representantes" 
    : formType === "teacher"
    ? "Formulario de Docentes"
    : "Formulario de Estudiantes";

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Formularios", href: "/school/configuraciones/formularios" },
    { label: title },
  ];

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Compute fields count per group
  const fieldsCountByGroup = fields.reduce((acc, field) => {
    if (field.group_id) {
      acc[field.group_id] = (acc[field.group_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  return (
    <DashboardLayout>
      <PageHeader title="Configuraciones - Formularios" breadcrumbs={breadcrumbs} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/school/configuraciones/formularios")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsGroupsModalOpen(true)} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Gestionar Grupos
            </Button>
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Campo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Orden</TableHead>
                <TableHead>Nombre del Campo</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Requerido</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isLoadingSchool ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay campos configurados. Haz clic en "Agregar Campo" para comenzar.
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => {
                  const TypeIcon = getFieldTypeIcon(field.field_type);
                  return (
                    <TableRow key={field.id} className={!field.is_visible ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{index + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{field.field_label}</p>
                          <p className="text-xs text-muted-foreground">{field.field_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {groups.find(g => g.id === field.group_id)?.name || "Sin grupo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{getFieldTypeLabel(field.field_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {field.is_required ? (
                          <Badge variant="default" className="bg-primary">Sí</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={field.is_visible}
                          onCheckedChange={(checked) => 
                            toggleVisibilityMutation.mutate({ id: field.id, is_visible: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(field)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(field.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-white text-xl">
              {editingField ? "Editar Campo" : "Nuevo Formulario"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              <h3 className="text-center font-semibold text-lg">
                {editingField ? "Editar Campo" : `Nuevo Formulario para ${formType === "representative" ? "Representantes" : formType === "teacher" ? "Docentes" : "Estudiantes"}`}
              </h3>

              {!editingField && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Nombre del formulario</Label>
                    <Select value={selectedPredefined} onValueChange={handlePredefinedChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar predefinido..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PREDEFINED_FIELDS[formType].map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>O escribe uno personalizado</Label>
                    <Input
                      placeholder="Ej: Nombre del padre"
                      value={fieldLabel}
                      onChange={(e) => {
                        setFieldLabel(e.target.value);
                        setFieldName(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                        setSelectedPredefined("");
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_required"
                      checked={isRequired}
                      onCheckedChange={(checked) => setIsRequired(checked as boolean)}
                    />
                    <Label htmlFor="is_required" className="cursor-pointer">Requerido</Label>
                  </div>
                </div>
              )}

              {editingField && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Etiqueta del campo</Label>
                    <Input
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      placeholder="Ej: Nombre completo"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <Checkbox
                      id="is_required_edit"
                      checked={isRequired}
                      onCheckedChange={(checked) => setIsRequired(checked as boolean)}
                    />
                    <Label htmlFor="is_required_edit" className="cursor-pointer">Requerido</Label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de campo</Label>
                  <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select 
                    value={selectedGroupId || "none"} 
                    onValueChange={(v) => setSelectedGroupId(v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin grupo</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Texto de ayuda..."
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeModal} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="ghost" className="text-primary hover:text-primary" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El campo se eliminará permanentemente del formulario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Groups Manager Modal */}
      <FormGroupsManager
        isOpen={isGroupsModalOpen}
        onClose={() => setIsGroupsModalOpen(false)}
        groups={groups}
        schoolId={schoolId || ""}
        formType={formType}
        fieldsCount={fieldsCountByGroup}
      />
    </DashboardLayout>
  );
}
