import { useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnrolledStudent } from "@/hooks/useTeacherAttendance";

interface StudentAttendanceCardProps {
  student: EnrolledStudent;
  status: "present" | "absent" | null;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
  disabled?: boolean;
}

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function StudentAttendanceCard({
  student,
  status,
  onMarkPresent,
  onMarkAbsent,
  disabled = false,
}: StudentAttendanceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const THRESHOLD = 80;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    startX.current = e.clientX;
    isDragging.current = true;
    cardRef.current?.setPointerCapture(e.pointerId);
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragOffset(Math.max(-120, Math.min(120, delta)));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (dragOffset >= THRESHOLD) {
      onMarkPresent();
    } else if (dragOffset <= -THRESHOLD) {
      onMarkAbsent();
    }

    setDragOffset(0);
    startX.current = null;
  }, [dragOffset, onMarkPresent, onMarkAbsent]);

  const swipeProgress = Math.abs(dragOffset) / THRESHOLD;
  const isPullingRight = dragOffset > 20;
  const isPullingLeft = dragOffset < -20;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card shadow-sm select-none",
        status === "present" && "border-green-500 bg-green-50",
        status === "absent" && "border-red-400 bg-red-50",
        !status && "border-border"
      )}
    >
      {/* Swipe hint overlays */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-4 pointer-events-none"
        style={{ opacity: isPullingRight ? Math.min(swipeProgress, 1) : 0 }}
      >
        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
          <Check className="h-5 w-5" />
          Presente
        </div>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none"
        style={{ opacity: isPullingLeft ? Math.min(swipeProgress, 1) : 0 }}
      >
        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
          Ausente
          <X className="h-5 w-5" />
        </div>
      </div>

      {/* Card body */}
      <div
        ref={cardRef}
        className="relative flex items-center gap-3 p-3 touch-pan-y cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging.current ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <Avatar className="h-10 w-10 shrink-0">
          {student.photoUrl && <AvatarImage src={student.photoUrl} alt={student.fullName} />}
          <AvatarFallback className="text-xs font-semibold">
            {getInitials(student.fullName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{student.fullName}</p>
          {student.documentId && (
            <p className="text-xs text-muted-foreground">{student.documentId}</p>
          )}
        </div>

        {status && (
          <Badge
            className={cn(
              "shrink-0 text-xs",
              status === "present"
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-red-100 text-red-800 border-red-200"
            )}
            variant="outline"
          >
            {status === "present" ? "Presente" : "Ausente"}
          </Badge>
        )}

        {/* Desktop / fallback buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="icon"
            variant={status === "absent" ? "destructive" : "outline"}
            className="h-7 w-7"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onMarkAbsent();
            }}
            title="Marcar ausente"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={status === "present" ? "default" : "outline"}
            className={cn("h-7 w-7", status === "present" && "bg-green-600 hover:bg-green-700")}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onMarkPresent();
            }}
            title="Marcar presente"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
