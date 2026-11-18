import { describe, expect, it } from "vitest";
import { buildNewFormFieldRow } from "./new-form-field";

const ctx = { schoolId: "school-1", formType: "student", existingOrders: [0, 3, 7] };

describe("buildNewFormFieldRow", () => {
  it("keeps the selected group", () => {
    const row = buildNewFormFieldRow(
      { field_name: "deporte_favorito", field_label: "Deporte favorito", field_type: "text", group_id: "group-9" },
      ctx,
    );
    expect(row.group_id).toBe("group-9");
  });

  it("stores null when no group was chosen", () => {
    expect(buildNewFormFieldRow({ field_name: "x", field_label: "X", field_type: "text" }, ctx).group_id).toBeNull();
    expect(buildNewFormFieldRow({ field_name: "x", field_label: "X", field_type: "text", group_id: null }, ctx).group_id).toBeNull();
  });

  it("places the field after the last one and fills defaults", () => {
    const row = buildNewFormFieldRow({ field_name: "x", field_label: "X", field_type: "text", placeholder: "" }, ctx);
    expect(row).toMatchObject({ school_id: "school-1", form_type: "student", field_order: 8, placeholder: null, is_required: false });
    expect(buildNewFormFieldRow({ field_name: "x" }, { ...ctx, existingOrders: [] }).field_order).toBe(0);
  });
});
