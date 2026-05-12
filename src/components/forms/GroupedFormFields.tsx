import { useMemo } from "react";
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

// Base geographic types we recognize
const GEO_BASES = ["pais", "estado", "municipio", "ciudad", "parroquia"] as const;
type GeoBase = typeof GEO_BASES[number];

// Considera Venezuela (case-insensitive, también acepta variantes con tilde)
function isVenezuela(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;
  return value.trim().toLowerCase() === "venezuela";
}

/**
 * Detects whether a field_name corresponds to a geographic base.
 * Matches both "estado" and "estado_nacimiento" (or any suffix like "estado_residencia").
 */
function getGeoBase(fieldName: string): GeoBase | null {
  for (const base of GEO_BASES) {
    if (fieldName === base || fieldName.startsWith(base + "_")) {
      return base;
    }
  }
  return null;
}

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

  // Build a map from geo base -> actual field_name in this form
  // e.g. { estado: "estado_nacimiento", municipio: "municipio_nacimiento", ... }
  const geoKeyMap = useMemo(() => {
    const map: Partial<Record<GeoBase, string>> = {};
    for (const field of fields) {
      const base = getGeoBase(field.field_name);
      if (base) {
        map[base] = field.field_name;
      }
    }
    return map;
  }, [fields]);

  // Helper to get the actual formData key for a geo base
  const geoKey = (base: GeoBase): string => geoKeyMap[base] || base;

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

  // Effective IDs: formData (using actual key) > initial prop > ""
  const effectiveStateId = formData[geoKey("estado")] || initialStateId || "";
  const effectiveMunicipalityId = formData[geoKey("municipio")] || initialMunicipalityId || "";
  const effectiveCityId = formData[geoKey("ciudad")] || initialCityId || "";
  const effectiveParishId = formData[geoKey("parroquia")] || initialParishId || "";


  // Fetch municipalities using useQuery for proper caching and race condition handling
  const { data: municipalities = [] } = useQuery({
    queryKey: ["municipalities", effectiveStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name")
        .eq("state_id", effectiveStateId)
        .order("name");
      if (error) throw error;
      return data as LocationOption[];
    },
    enabled: !!effectiveStateId,
  });

  // Fetch cities using useQuery
  const { data: cities = [] } = useQuery({
    queryKey: ["cities", effectiveStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .eq("state_id", effectiveStateId)
        .order("name");
      if (error) throw error;
      return data as LocationOption[];
    },
    enabled: !!effectiveStateId,
  });

  // Fetch parishes using useQuery
  const { data: parishes = [] } = useQuery({
    queryKey: ["parishes", effectiveMunicipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parishes")
        .select("id, name")
        .eq("municipality_id", effectiveMunicipalityId)
        .order("name");
      if (error) throw error;
      return data as LocationOption[];
    },
    enabled: !!effectiveMunicipalityId,
  });

  const handleStateChange = (value: string) => {
    const currentState = formData[geoKey("estado")];
    onFieldChange(geoKey("estado"), value);
    // Only clear dependents if state actually changed (not on programmatic value sync)
    if (!currentState || currentState !== value) {
      onFieldChange(geoKey("municipio"), "");
      onFieldChange(geoKey("ciudad"), "");
      onFieldChange(geoKey("parroquia"), "");
    }
  };

  const handleMunicipalityChange = (value: string) => {
    const currentMun = formData[geoKey("municipio")];
    onFieldChange(geoKey("municipio"), value);
    if (!currentMun || currentMun !== value) {
      onFieldChange(geoKey("parroquia"), "");
    }
  };

  // Auto-persist "pais" fields that are hardcoded to "Venezuela"
  const paisFields = useMemo(() => 
    fields.filter(f => getGeoBase(f.field_name) === "pais"), 
    [fields]
  );
  
  // On mount / when formData changes, ensure pais fields have "Venezuela" persisted
  useMemo(() => {
    paisFields.forEach(f => {
      if (!formData[f.field_name]) {
        setTimeout(() => onFieldChange(f.field_name, "Venezuela"), 0);
      }
    });
  }, [paisFields, formData, onFieldChange]);

  // Auto-persist geographic initial values into formData when they exist but aren't saved yet
  useMemo(() => {
    const geoInitials: { base: GeoBase; value: string | null | undefined }[] = [
      { base: "estado", value: initialStateId },
      { base: "municipio", value: initialMunicipalityId },
      { base: "ciudad", value: initialCityId },
      { base: "parroquia", value: initialParishId },
    ];
    geoInitials.forEach(({ base, value }) => {
      const key = geoKey(base);
      if (value && !formData[key]) {
        setTimeout(() => onFieldChange(key, value), 0);
      }
    });
  }, [initialStateId, initialMunicipalityId, initialCityId, initialParishId, geoKey, formData, onFieldChange]);

  const renderGeographicField = (field: FormField, base: GeoBase) => {
    if (base === "pais") {
      return (
        <Select value={formData[field.field_name] || "Venezuela"} disabled>
          <SelectTrigger>
            <SelectValue placeholder="Venezuela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Venezuela">Venezuela</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (base === "estado") {
      return (
        <Select value={effectiveStateId || undefined} onValueChange={handleStateChange}>
          <SelectTrigger translate="no">
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

    if (base === "municipio") {
      return (
        <Select 
          value={effectiveMunicipalityId || undefined} 
          onValueChange={handleMunicipalityChange}
          disabled={!effectiveStateId || municipalities.length === 0}
        >
          <SelectTrigger translate="no">
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

    if (base === "ciudad") {
      // If there's no estado field in this form AND no initialStateId, render as text input
      const hasEstadoField = !!geoKeyMap["estado"];
      const hasStateContext = hasEstadoField || !!effectiveStateId;
      
      if (!hasStateContext) {
        return (
          <Input
            type="text"
            placeholder={field.placeholder || field.field_label}
            value={formData[field.field_name] || ""}
            onChange={(e) => onFieldChange(field.field_name, e.target.value)}
          />
        );
      }
      
      return (
        <Select 
          value={effectiveCityId || undefined} 
          onValueChange={(val) => onFieldChange(geoKey("ciudad"), val)}
          disabled={!effectiveStateId || cities.length === 0}
        >
          <SelectTrigger translate="no">
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

    if (base === "parroquia") {
      return (
        <Select 
          value={effectiveParishId || undefined} 
          onValueChange={(val) => onFieldChange(geoKey("parroquia"), val)}
          disabled={!effectiveMunicipalityId || parishes.length === 0}
        >
          <SelectTrigger translate="no">
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
    const base = getGeoBase(field.field_name);
    if (base) {
      return renderGeographicField(field, base);
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
      case "select": {
        const rawOptions = Array.isArray(field.options) ? field.options : [];
        // Radix Select crashes if an item has an empty string value, so we
        // filter out empty/null/undefined options defensively.
        const options = rawOptions
          .map((opt: any) => (opt == null ? "" : String(opt)))
          .filter((opt: string) => opt.trim().length > 0);
        return (
          <Select
            value={value || undefined}
            onValueChange={(val) => onFieldChange(field.field_name, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || field.field_label} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt, idx) => (
                <SelectItem key={`${idx}-${opt}`} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
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
