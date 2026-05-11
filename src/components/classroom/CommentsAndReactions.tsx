import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, Send, Smile, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

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
}

interface Comment {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface Reaction {
  id: string;
  author_id: string;
  emoji: string;
}

export function CommentsAndReactions({ schoolId, postId, activityId, allowComments = true }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const targetKey = postId ? ["post", postId] : ["activity", activityId];

  // Comments
  const { data: comments = [] } = useQuery({
    queryKey: ["cr-comments", ...targetKey],
    queryFn: async () => {
      const q = supabase
        .from("classroom_comments")
        .select("id, author_id, content, created_at")
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
        .select("id, author_id, emoji");
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

  const labelFor = (uid: string) => {
    if (uid === user?.id) return { name: "Tú", role: "" };
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["cr-comments", ...targetKey] });
    },
    onError: (e: any) => toast.error(e?.message || "Error al comentar"),
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const existing = reactions.find((r) => r.author_id === user!.id && r.emoji === emoji);
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
        });
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

  const myReacted = (emoji: string) => reactions.some((r) => r.author_id === user!.id && r.emoji === emoji);

  return (
    <div className="border-t pt-2 mt-2 space-y-2">
      {/* Reactions row */}
      <div className="flex items-center gap-1 flex-wrap">
        {Object.entries(grouped).map(([emoji, list]) => (
          <Button
            key={emoji}
            type="button"
            variant={myReacted(emoji) ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => toggleReaction.mutate(emoji)}
            disabled={toggleReaction.isPending}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="font-medium">{list.length}</span>
          </Button>
        ))}
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
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-muted">
                  {c.author_id === user?.id ? "T" : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    {c.author_id === user?.id ? "Tú" : "Usuario"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(c.created_at), "d MMM, HH:mm", { locale: es })}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
            </div>
          ))}

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
    </div>
  );
}
