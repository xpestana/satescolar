import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, Send, Smile, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const ROLE_LABEL: Record<string, string> = {
  teacher: "Docente",
  representative: "Representante",
  school: "Colegio",
  admin: "Admin",
  user: "",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🔥", "😮", "😢"];

interface Props {
  schoolId: string;
  postId?: string;
  activityId?: string;
  /** Whether comments input is allowed (defaults to true). */
  allowComments?: boolean;
  /** When set, comments/reactions are recorded as being posted by this student
   *  (e.g. representative entered the classroom via the student's access code). */
  actingStudentId?: string;
  /** Assignment id; used to detect if the current user is the teacher owner
   *  so they can delete any comment on this post/activity. */
  assignmentId?: string;
}

interface Comment {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  as_student_id: string | null;
}

interface Reaction {
  id: string;
  author_id: string;
  emoji: string;
  as_student_id: string | null;
}

export function CommentsAndReactions({ schoolId, postId, activityId, allowComments = true, actingStudentId, assignmentId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const targetKey = postId ? ["post", postId] : ["activity", activityId];

  // Detect if current user is the teacher owner of the assignment (can delete any comment)
  const { data: isTeacherOwner = false } = useQuery({
    queryKey: ["cr-is-teacher-owner", assignmentId, user?.id],
    queryFn: async () => {
      if (!assignmentId || !user?.id) return false;
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select("id, teacher:teacher_id!inner(user_id)")
        .eq("id", assignmentId)
        .maybeSingle();
      if (error) return false;
      return (data as any)?.teacher?.user_id === user.id;
    },
    enabled: !!assignmentId && !!user?.id,
  });

  // Comments
  const { data: comments = [] } = useQuery({
    queryKey: ["cr-comments", ...targetKey],
    queryFn: async () => {
      const q = supabase
        .from("classroom_comments")
        .select("id, author_id, content, created_at, as_student_id")
        .order("created_at", { ascending: true });
      const { data, error } = postId
        ? await q.eq("post_id", postId)
        : await q.eq("activity_id", activityId!);
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: open && !!(postId || activityId),
  });

  // Reactions (always loaded so we can show counts even when collapsed)
  const { data: reactions = [] } = useQuery({
    queryKey: ["cr-reactions", ...targetKey],
    queryFn: async () => {
      const q = supabase
        .from("classroom_reactions")
        .select("id, author_id, emoji, as_student_id");
      const { data, error } = postId
        ? await q.eq("post_id", postId)
        : await q.eq("activity_id", activityId!);
      if (error) throw error;
      return (data || []) as Reaction[];
    },
    enabled: !!(postId || activityId),
  });

  // Resolve display names for all author ids (comments + reactions)
  const authorIds = Array.from(
    new Set([...comments.map((c) => c.author_id), ...reactions.map((r) => r.author_id)])
  );
  const { data: nameMap = {} } = useQuery({
    queryKey: ["cr-names", schoolId, authorIds.sort().join(",")],
    queryFn: async () => {
      if (authorIds.length === 0) return {};
      const { data, error } = await supabase.rpc("resolve_user_display_names", {
        _user_ids: authorIds,
        _school_id: schoolId,
      });
      if (error) throw error;
      const map: Record<string, { name: string; role: string }> = {};
      for (const row of (data || []) as Array<{ user_id: string; display_name: string; role: string }>) {
        map[row.user_id] = { name: row.display_name || "Usuario", role: row.role || "user" };
      }
      return map;
    },
    enabled: authorIds.length > 0,
  });

  // Resolve student names for "as_student_id" markers
  const studentIds = Array.from(
    new Set(
      [
        ...comments.map((c) => c.as_student_id),
        ...reactions.map((r) => r.as_student_id),
      ].filter((x): x is string => !!x)
    )
  );
  const { data: studentMap = {} } = useQuery({
    queryKey: ["cr-student-names", schoolId, studentIds.sort().join(",")],
    queryFn: async () => {
      if (studentIds.length === 0) return {};
      const { data, error } = await supabase.rpc("resolve_student_display_names", {
        _student_ids: studentIds,
        _school_id: schoolId,
      });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data || []) as Array<{ student_id: string; display_name: string }>) {
        map[row.student_id] = row.display_name || "Estudiante";
      }
      return map;
    },
    enabled: studentIds.length > 0,
  });

  const labelFor = (uid: string, asStudentId?: string | null) => {
    if (asStudentId && studentMap[asStudentId]) {
      return { name: studentMap[asStudentId], role: "Estudiante" };
    }
    if (asStudentId && actingStudentId && asStudentId === actingStudentId) {
      // Fallback while name is loading
      return { name: "Estudiante", role: "Estudiante" };
    }
    if (uid === user?.id && !actingStudentId) return { name: "Tú", role: "" };
    const r = nameMap[uid];
    return r ? { name: r.name, role: ROLE_LABEL[r.role] ?? "" } : { name: "Usuario", role: "" };
  };

  const addComment = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      const { error } = await supabase.from("classroom_comments").insert({
        author_id: user!.id,
        school_id: schoolId,
        content: text.trim(),
        post_id: postId ?? null,
        activity_id: activityId ?? null,
        is_private: false,
        as_student_id: actingStudentId ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["cr-comments", ...targetKey] });
    },
    onError: (e: any) => toast.error(e?.message || "Error al comentar"),
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("classroom_comments")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingText("");
      queryClient.invalidateQueries({ queryKey: ["cr-comments", ...targetKey] });
    },
    onError: (e: any) => toast.error(e?.message || "Error al editar el comentario"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classroom_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["cr-comments", ...targetKey] });
      toast.success("Comentario eliminado");
    },
    onError: (e: any) => toast.error(e?.message || "Error al eliminar"),
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      // Match my own reaction taking acting student into account
      const existing = reactions.find(
        (r) =>
          r.author_id === user!.id &&
          r.emoji === emoji &&
          (r.as_student_id ?? null) === (actingStudentId ?? null)
      );
      if (existing) {
        const { error } = await supabase.from("classroom_reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classroom_reactions").insert({
          author_id: user!.id,
          school_id: schoolId,
          emoji,
          post_id: postId ?? null,
          activity_id: activityId ?? null,
          as_student_id: actingStudentId ?? null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cr-reactions", ...targetKey] }),
    onError: (e: any) => toast.error(e?.message || "Error con la reacción"),
  });

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  const myReacted = (emoji: string) =>
    reactions.some(
      (r) =>
        r.author_id === user!.id &&
        r.emoji === emoji &&
        (r.as_student_id ?? null) === (actingStudentId ?? null)
    );

  return (
    <div className="border-t pt-2 mt-2 space-y-2">
      {/* Reactions row */}
      <div className="flex items-center gap-1 flex-wrap">
        {Object.entries(grouped).map(([emoji, list]) => {
          const names = list.map((r) => labelFor(r.author_id, r.as_student_id).name).join(", ");
          return (
            <Button
              key={emoji}
              type="button"
              variant={myReacted(emoji) ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => toggleReaction.mutate(emoji)}
              disabled={toggleReaction.isPending}
              title={names}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="font-medium">{list.length}</span>
            </Button>
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Smile className="h-3.5 w-3.5 mr-1" />
              Reaccionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="text-xl hover:scale-125 transition-transform p-1"
                  onClick={() => toggleReaction.mutate(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          {open ? "Ocultar" : "Comentarios"}
        </Button>
      </div>

      {/* Comments list + input */}
      {open && (
        <div className="space-y-2 pl-1">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">Sé el primero en comentar.</p>
          )}
          {comments.map((c) => {
            const info = labelFor(c.author_id, c.as_student_id);
            const isAuthor = c.author_id === user?.id;
            const canDelete = isAuthor || isTeacherOwner;
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-muted">
                    {initialsOf(info.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">{info.name}</span>
                    {info.role && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {info.role}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(c.created_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="mt-1 space-y-1">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setEditingId(null); setEditingText(""); }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!editingText.trim() || updateComment.isPending}
                          onClick={() => updateComment.mutate({ id: c.id, content: editingText.trim() })}
                        >
                          {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{c.content}</p>
                  )}
                </div>
                {(isAuthor || canDelete) && !isEditing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isAuthor && (
                        <DropdownMenuItem
                          onClick={() => { setEditingId(c.id); setEditingText(c.content); }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={() => setDeleteId(c.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}

          {allowComments && (
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Escribe un comentario..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addComment.mutate();
                  }
                }}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={() => addComment.mutate()}
                disabled={!text.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar comentario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteComment.mutate(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
