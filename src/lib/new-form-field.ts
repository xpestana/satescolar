// Builds the row inserted in `form_fields` when a school adds a field from the form editor.

export interface NewFormFieldInput<FieldType extends string = string> {
  field_name?: string;
  field_label?: string;
  field_type?: FieldType;
  placeholder?: string | null;
  is_required?: boolean;
  group_id?: string | null;
}

export interface NewFormFieldContext<FormType extends string = string> {
  schoolId: string;
  formType: FormType;
  /** field_order values already used in this form. */
  existingOrders: number[];
}

/** The new field goes last, and keeps the group the user picked (null = "Sin grupo"). */
export function buildNewFormFieldRow<FieldType extends string, FormType extends string>(
  input: NewFormFieldInput<FieldType>,
  ctx: NewFormFieldContext<FormType>,
) {
  const fieldOrder = ctx.existingOrders.length > 0 ? Math.max(...ctx.existingOrders) + 1 : 0;
  return {
    school_id: ctx.schoolId,
    form_type: ctx.formType,
    field_name: input.field_name,
    field_label: input.field_label,
    field_type: input.field_type,
    placeholder: input.placeholder || null,
    is_required: input.is_required || false,
    group_id: input.group_id ?? null,
    field_order: fieldOrder,
  };
}
