UPDATE public.form_fields
SET options = '["Padre", "Madre", "Abuelo(a)", "Tío(a)", "Hermano(a)", "Tutor Legal", "Otro"]'::jsonb
WHERE field_name = 'parentesco' AND form_type = 'representative' AND options IS NULL;