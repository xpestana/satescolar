import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/integrations/supabase/types";

interface FormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_visible: boolean;
  placeholder: string | null;
  options: Json | null;
  field_order: number;
  group_id: string | null;
}

interface FormFieldGroup {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

interface LocationOption {
  id: string;
  name: string;
}

interface GroupedFormFieldsProps {
  fields: FormField[];
  groups: FormFieldGroup[];
  formData: Record<string, any>;
  onFieldChange: (fieldName: string, value: any) => void;
  initialStateId?: string | null;
  initialMunicipalityId?: string | null;
  initialCityId?: string | null;
  initialParishId?: string | null;
}

// Geographic field names that need special handling
const GEOGRAPHIC_FIELDS = ["pais", "estado", "municipio", "ciudad", "parroquia"];

export function GroupedFormFields({ 
  fields, 
  groups, 
  formData, 
  onFieldChange,
  initialStateId,
  initialMunicipalityId,
  initialCityId,
  initialParishId,
}: GroupedFormFieldsProps) {
  const [municipalities, setMunicipalities] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [parishes, setParishes] = useState<LocationOption[]>([]);

  // Compute effective geographic values (formData takes priority, then initial from family)
  const effectiveStateId = formData.estado || initialStateId || "";
  const effectiveMunicipalityId = formData.municipio || initialMunicipalityId || "";
  const effectiveCityId = formData.ciudad || initialCityId || "";
  const effectiveParishId = formData.parroquia || initialParishId || "";

  // Fetch states
  const { data: states = [] } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("states")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as LocationOption[];
    },
  });

  // Fetch municipalities when effective state changes
  useEffect(() => {
    if (!effectiveStateId) {
      setMunicipalities([]);
      return;
    }
    supabase
      .from("municipalities")
      .select("id, name")
      .eq("state_id", effectiveStateId)
      .order("name")
      .then(({ data }) => setMunicipalities(data || []));
  }, [effectiveStateId]);

  // Fetch cities when effective state changes
  useEffect(() => {
    if (!effectiveStateId) {
      setCities([]);
      return;
    }
    supabase
      .from("cities")
      .select("id, name")
      .eq("state_id", effectiveStateId)
      .order("name")
      .then(({ data }) => setCities(data || []));
  }, [effectiveStateId]);

  // Fetch parishes when effective municipality changes
  useEffect(() => {
    if (!effectiveMunicipalityId) {
      setParishes([]);
      return;
    }
    supabase
      .from("parishes")
      .select("id, name")
      .eq("municipality_id", effectiveMunicipalityId)
      .order("name")
      .then(({ data }) => setParishes(data || []));
  }, [effectiveMunicipalityId]);

  const isGeographicField = (fieldName: string) => GEOGRAPHIC_FIELDS.includes(fieldName);

  const handleStateChange = (value: string) => {
    onFieldChange("estado", value);
    onFieldChange("municipio", "");
    onFieldChange("ciudad", "");
    onFieldChange("parroquia", "");
    setParishes([]);
  };

  const handleMunicipalityChange = (value: string) => {
    onFieldChange("municipio", value);
    onFieldChange("parroquia", "");
  };

  const renderGeographicField = (field: FormField) => {

    if (field.field_name === "pais") {
      return (
        <Select value="Venezuela" disabled>
          <SelectTrigger>
            <SelectValue placeholder="Venezuela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Venezuela">Venezuela</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === "estado") {
      return (
        <Select value={effectiveStateId} onValueChange={handleStateChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccione estado" />
          </SelectTrigger>
          <SelectContent>
            {states.map((state) => (
              <SelectItem key={state.id} value={state.id}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === "municipio") {
      return (
        <Select 
          value={effectiveMunicipalityId} 
          onValueChange={handleMunicipalityChange}
          disabled={!effectiveStateId || municipalities.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={!effectiveStateId ? "Seleccione estado primero" : "Seleccione municipio"} />
          </SelectTrigger>
          <SelectContent>
            {municipalities.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === "ciudad") {
      return (
        <Select 
          value={effectiveCityId} 
          onValueChange={(val) => onFieldChange("ciudad", val)}
          disabled={!effectiveStateId || cities.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={!effectiveStateId ? "Seleccione estado primero" : "Seleccione ciudad"} />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === "parroquia") {
      return (
        <Select 
          value={effectiveParishId} 
          onValueChange={(val) => onFieldChange("parroquia", val)}
          disabled={!effectiveMunicipalityId || parishes.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={!effectiveMunicipalityId ? "Seleccione municipio primero" : "Seleccione parroquia"} />
          </SelectTrigger>
          <SelectContent>
            {parishes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return null;
  };
  
  const renderField = (field: FormField) => {
    if (isGeographicField(field.field_name)) {
      return renderGeographicField(field);
    }

    const value = formData[field.field_name] || "";

    switch (field.field_type) {
      case "textarea":
        return (
          <Textarea
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      case "select":
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <Select
            value={value}
            onValueChange={(val) => onFieldChange(field.field_name, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || field.field_label} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: any, idx: number) => (
                <SelectItem key={idx} value={String(opt)}>
                  {String(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.field_name}
              checked={!!value}
              onCheckedChange={(checked) => onFieldChange(field.field_name, checked)}
            />
            <label htmlFor={field.field_name} className="text-sm">
              {field.field_label}
            </label>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      case "email":
        return (
          <Input
            type="email"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            type="tel"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      default:
        return (
          <Input
            type="text"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
    }
  };

  // Sort groups by display_order
  const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);
  
  // Get fields without a group
  const ungroupedFields = fields.filter(f => !f.group_id);

  return (
    <div className="space-y-6">
      {sortedGroups.map((group) => {
        const groupFields = fields
          .filter(f => f.group_id === group.id)
          .sort((a, b) => a.field_order - b.field_order);

        if (groupFields.length === 0) return null;

        return (
          <Card key={group.id}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{group.name}</CardTitle>
              {group.description && (
                <CardDescription>{group.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    {field.field_type !== "checkbox" && (
                      <Label htmlFor={field.field_name}>
                        {field.field_label}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    )}
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Ungrouped fields */}
      {ungroupedFields.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Otros Campos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ungroupedFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  {field.field_type !== "checkbox" && (
                    <Label htmlFor={field.field_name}>
                      {field.field_label}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  )}
                  {renderField(field)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
