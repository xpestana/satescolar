import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherData } from "@/hooks/useTeacherData";

export interface ClassroomAssignment {
  id: string;
  school_id: string;
  subject: { id: string; name: string; subject_type: string; evaluation_type: string };
  school_year: { id: string; year_range: string; is_active: boolean };
  section: { id: string; name: string; grade_level: string } | null;
}

export interface ClassroomConfig {
  id: string;
  assignment_id: string;
  school_id: string;
  cover_url: string | null;
  color: string;
  description: string;
  welcome_message: string;
  rules: string;
  allow_student_comments: boolean;
  allow_student_posts: boolean;
  is_archived: boolean;
}

export interface ClassroomTopic {
  id: string;
  assignment_id: string;
  school_id: string;
  name: string;
  description: string;
  display_order: number;
  is_visible: boolean;
  is_archived: boolean;
}

export function useClassroomAssignments() {
  const { teacher } = useTeacherData();

  return useQuery({
    queryKey: ["classroom-assignments", teacher?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id,
          subject:subject_id(id, name, subject_type, evaluation_type),
          school_year:school_year_id(id, year_range, is_active),
          section:section_id(id, name, grade_level)
        `)
        .eq("teacher_id", teacher!.id)
        .eq("is_suspended", false);
      if (error) throw error;
      return (data as unknown as ClassroomAssignment[]) || [];
    },
    enabled: !!teacher?.id,
  });
}

export function useClassroomConfig(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ["classroom-config", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_config")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .maybeSingle();
      if (error) throw error;
      return data as ClassroomConfig | null;
    },
    enabled: !!assignmentId,
  });
}

export function useUpsertClassroomConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<ClassroomConfig> & { assignment_id: string; school_id: string }) => {
      const { data: existing } = await supabase
        .from("classroom_config")
        .select("id")
        .eq("assignment_id", config.assignment_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("classroom_config")
          .update({
            color: config.color,
            description: config.description,
            welcome_message: config.welcome_message,
            rules: config.rules,
            allow_student_comments: config.allow_student_comments,
            allow_student_posts: config.allow_student_posts,
            cover_url: config.cover_url,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("classroom_config")
          .insert({
            assignment_id: config.assignment_id,
            school_id: config.school_id,
            color: config.color || "#4285f4",
            description: config.description || "",
            welcome_message: config.welcome_message || "",
            rules: config.rules || "",
            allow_student_comments: config.allow_student_comments ?? true,
            allow_student_posts: config.allow_student_posts ?? false,
            cover_url: config.cover_url,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-config", vars.assignment_id] });
    },
  });
}

export function useClassroomTopics(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ["classroom-topics", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_topics")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as ClassroomTopic[]) || [];
    },
    enabled: !!assignmentId,
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (topic: { assignment_id: string; school_id: string; name: string; description?: string; display_order?: number }) => {
      const { error } = await supabase.from("classroom_topics").insert(topic);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-topics", vars.assignment_id] });
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignment_id, ...updates }: Partial<ClassroomTopic> & { id: string; assignment_id: string }) => {
      const { error } = await supabase.from("classroom_topics").update(updates).eq("id", id);
      if (error) throw error;
      return assignment_id;
    },
    onSuccess: (assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-topics", assignmentId] });
    },
  });
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignment_id }: { id: string; assignment_id: string }) => {
      const { error } = await supabase.from("classroom_topics").delete().eq("id", id);
      if (error) throw error;
      return assignment_id;
    },
    onSuccess: (assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-topics", assignmentId] });
    },
  });
}
