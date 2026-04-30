import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone, Pin, PinOff, MessageSquare, Send, Paperclip,
  MoreVertical, Pencil, Trash2, Loader2, Clock, FileText, Link as LinkIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { S3AttachmentInput, type PendingAttachment } from "./S3AttachmentInput";
import { ListItemSkeleton } from "@/components/ui/loading-skeletons";

interface Props {
  assignmentId: string;
  schoolId: string;
  allowStudentPosts?: boolean;
}

interface Post {
  id: string;
  assignment_id: string;
  author_id: string;
  school_id: string;
  post_type: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  allow_comments: boolean;
  status: string;
  scheduled_at: string | null;
  topic_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

interface PostAttachment {
  id: string;
  post_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

export function StreamFeed({ assignmentId, schoolId, allowStudentPosts }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Fetch posts
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["classroom-posts", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classroom_posts")
        .select("*")
        .eq("assignment_id", assignmentId)
        .in("status", ["published"])
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Post[];
    },
  });

  // Fetch comments for expanded posts
  const { data: commentsMap = {} } = useQuery({
    queryKey: ["classroom-comments", assignmentId, Array.from(expandedComments)],
    queryFn: async () => {
      if (expandedComments.size === 0) return {};
      const postIds = Array.from(expandedComments);
      const { data, error } = await supabase
        .from("classroom_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, Comment[]> = {};
      (data || []).forEach((c: Comment) => {
        if (!map[c.post_id!]) map[c.post_id!] = [];
        map[c.post_id!].push(c);
      });
      return map;
    },
    enabled: expandedComments.size > 0,
  });

  // Fetch attachments
  const { data: attachmentsMap = {} } = useQuery({
    queryKey: ["classroom-post-attachments", assignmentId],
    queryFn: async () => {
      const postIds = posts.map(p => p.id);
      if (postIds.length === 0) return {};
      const { data, error } = await supabase
        .from("classroom_post_attachments")
        .select("*")
        .in("post_id", postIds);
      if (error) throw error;
      const map: Record<string, PostAttachment[]> = {};
      (data || []).forEach((a: PostAttachment) => {
        if (!map[a.post_id]) map[a.post_id] = [];
        map[a.post_id].push(a);
      });
      return map;
    },
    enabled: posts.length > 0,
  });

  // Create post
  const createPost = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("El contenido no puede estar vacío");
      const stillUploading = pendingAttachments.some(a => a.uploading);
      if (stillUploading) throw new Error("Espera a que terminen de subirse los archivos");

      const { data: post, error } = await supabase.from("classroom_posts").insert({
        assignment_id: assignmentId,
        school_id: schoolId,
        author_id: user!.id,
        content: content.trim(),
        title: title.trim() || null,
        post_type: "announcement",
        status: "published",
        is_pinned: isPinned,
        allow_comments: allowComments,
      }).select("id").single();
      if (error) throw error;

      // Persist uploaded attachments
      const uploaded = pendingAttachments.filter(a => a.publicUrl);
      if (uploaded.length > 0 && post) {
        const rows = uploaded.map(a => ({
          post_id: post.id,
          school_id: schoolId,
          file_url: a.publicUrl!,
          file_name: a.file.name,
          file_size: a.file.size,
          file_type: a.file.type || null,
        }));
        const { error: attErr } = await supabase
          .from("classroom_post_attachments")
          .insert(rows);
        if (attErr) throw attErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-posts", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["classroom-post-attachments", assignmentId] });
      setContent("");
      setTitle("");
      setComposing(false);
      setIsPinned(false);
      setAllowComments(true);
      setPendingAttachments([]);
      toast({ title: "Publicación creada" });
    },
    onError: (e: any) => toast({ title: e?.message || "Error al publicar", variant: "destructive" }),
  });

  // Toggle pin
  const togglePin = useMutation({
    mutationFn: async (post: Post) => {
      const { error } = await supabase
        .from("classroom_posts")
        .update({ is_pinned: !post.is_pinned })
        .eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classroom-posts", assignmentId] }),
  });

  // Delete post
  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("classroom_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-posts", assignmentId] });
      setDeleteTarget(null);
      toast({ title: "Publicación eliminada" });
    },
  });

  // Create comment
  const createComment = useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      const { error } = await supabase.from("classroom_comments").insert({
        post_id: postId,
        author_id: user!.id,
        school_id: schoolId,
        content: text.trim(),
        is_private: false,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["classroom-comments", assignmentId] });
      setCommentTexts(prev => ({ ...prev, [vars.postId]: "" }));
    },
  });

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-4">
        <ListItemSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Compose area */}
      {!composing ? (
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setComposing(true)}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {user?.email?.charAt(0).toUpperCase() || "D"}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-sm">
              Publica algo para tu clase...
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input
              placeholder="Título (opcional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Escribe un anuncio para tu clase..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="allow-comments"
                    checked={allowComments}
                    onCheckedChange={setAllowComments}
                  />
                  <Label htmlFor="allow-comments" className="text-xs">Comentarios</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="pin-post"
                    checked={isPinned}
                    onCheckedChange={setIsPinned}
                  />
                  <Label htmlFor="pin-post" className="text-xs">Fijar</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setComposing(false); setContent(""); setTitle(""); }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => createPost.mutate()}
                  disabled={!content.trim() || createPost.isPending}
                >
                  {createPost.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Publicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts list */}
      {posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay publicaciones aún</p>
          <p className="text-sm mt-1">Crea tu primer anuncio para la clase.</p>
        </div>
      )}

      {posts.map((post) => {
        const postAttachments = attachmentsMap[post.id] || [];
        const postComments = commentsMap[post.id] || [];
        const isExpanded = expandedComments.has(post.id);
        const commentText = commentTexts[post.id] || "";

        return (
          <Card key={post.id} className={post.is_pinned ? "border-primary/30 shadow-sm" : ""}>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {post.author_id === user?.id ? user?.email?.charAt(0).toUpperCase() : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {post.author_id === user?.id ? "Tú" : "Docente"}
                      </span>
                      {post.is_pinned && (
                        <Badge variant="outline" className="text-xs gap-1 py-0">
                          <Pin className="h-3 w-3" /> Fijado
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(post.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                {post.author_id === user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => togglePin.mutate(post)}>
                        {post.is_pinned ? (
                          <><PinOff className="h-4 w-4 mr-2" /> Desfijar</>
                        ) : (
                          <><Pin className="h-4 w-4 mr-2" /> Fijar</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(post.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {post.title && (
                <h4 className="font-semibold text-base">{post.title}</h4>
              )}
              <p className="text-sm whitespace-pre-wrap">{post.content}</p>

              {/* Attachments */}
              {postAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {postAttachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1.5 rounded-md hover:bg-muted/80 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {att.file_name}
                    </a>
                  ))}
                </div>
              )}

              {/* Comments toggle */}
              {post.allow_comments && (
                <div className="border-t pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => toggleComments(post.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    {isExpanded ? "Ocultar comentarios" : "Comentarios"}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-2 mt-2">
                      {postComments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 pl-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {c.author_id === user?.id ? "T" : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">
                                {c.author_id === user?.id ? "Tú" : "Usuario"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(c.created_at), "d MMM, HH:mm", { locale: es })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/90">{c.content}</p>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 pl-2">
                        <Input
                          placeholder="Escribe un comentario..."
                          value={commentText}
                          onChange={(e) =>
                            setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && commentText.trim()) {
                              createComment.mutate({ postId: post.id, text: commentText });
                            }
                          }}
                          className="text-xs h-8"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={!commentText.trim() || createComment.isPending}
                          onClick={() => {
                            if (commentText.trim()) {
                              createComment.mutate({ postId: post.id, text: commentText });
                            }
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también los comentarios asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deletePost.mutate(deleteTarget)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
