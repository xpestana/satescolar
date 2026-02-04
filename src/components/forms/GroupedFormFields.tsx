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

interface GroupedFormFieldsProps {
  fields: FormField[];
  groups: FormFieldGroup[];
  formData: Record<string, any>;
  onFieldChange: (fieldName: string, value: any) => void;
}

export function GroupedFormFields({ 
  fields, 
  groups, 
  formData, 
  onFieldChange 
}: GroupedFormFieldsProps) {
  
  const renderField = (field: FormField) => {
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
