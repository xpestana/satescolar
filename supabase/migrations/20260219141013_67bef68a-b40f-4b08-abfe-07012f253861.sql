
-- Table for general planilla config (header, footer, signatures)
CREATE TABLE public.planilla_general_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  header_config jsonb NOT NULL DEFAULT '{"show_logo": true, "show_name": true, "show_dea_code": true, "show_statistical_code": true, "show_address": true, "show_phone": true, "show_rif": true, "show_student_photo": true, "show_representative_photo": true}'::jsonb,
  footer_config jsonb NOT NULL DEFAULT '{"show_address": true, "show_phone": true, "show_rif": true}'::jsonb,
  signature_lines jsonb NOT NULL DEFAULT '["Firma del Representante", "Firma del Director(a)", "Firma del Coordinador(a)"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id)
);

ALTER TABLE public.planilla_general_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage planilla config" ON public.planilla_general_config FOR ALL USING (is_admin());
CREATE POLICY "School users can view their planilla config" ON public.planilla_general_config FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_general_config.school_id));
CREATE POLICY "School users can insert their planilla config" ON public.planilla_general_config FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_general_config.school_id));
CREATE POLICY "School users can update their planilla config" ON public.planilla_general_config FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_general_config.school_id));
CREATE POLICY "School users can delete their planilla config" ON public.planilla_general_config FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = planilla_general_config.school_id));

-- Insert default config for existing schools
INSERT INTO public.planilla_general_config (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_planilla_general_config_updated_at
BEFORE UPDATE ON public.planilla_general_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
