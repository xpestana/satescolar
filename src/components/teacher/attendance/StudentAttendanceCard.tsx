import { useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      startX.current = e.clientX;
      isDragging.current = true;
      cardRef.current?.setPointerCapture(e.pointerId);
    },
    [disabled]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragOffset(Math.max(-120, Math.min(120, delta)));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragOffset >= THRESHOLD) onMarkPresent();
    else if (dragOffset <= -THRESHOLD) onMarkAbsent();
    setDragOffset(0);
    startX.current = null;
  }, [dragOffset, onMarkPresent, onMarkAbsent]);

  const swipeProgress = Math.abs(dragOffset) / THRESHOLD;
  const isPullingRight = dragOffset > 20;
  const isPullingLeft = dragOffset < -20;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-sm select-none flex flex-col",
        status === "present" && "border-green-400 bg-green-50",
        status === "absent" && "border-red-400 bg-red-50",
        !status && "border-border bg-card"
      )}
    >
      {/* Swipe overlays */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-5 pointer-events-none z-10"
        style={{ opacity: isPullingRight ? Math.min(swipeProgress, 1) : 0 }}
      >
        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
          <Check className="h-5 w-5" />
          Asistente
        </div>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none z-10"
        style={{ opacity: isPullingLeft ? Math.min(swipeProgress, 1) : 0 }}
      >
        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
          Inasistente
          <X className="h-5 w-5" />
        </div>
      </div>

      {/* Card body — draggable zone */}
      <div
        ref={cardRef}
        className="relative flex flex-col items-center pt-6 pb-4 px-3 gap-2 flex-1 touch-pan-y cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging.current ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <Avatar className="h-20 w-20 shrink-0 ring-2 ring-offset-2 ring-border">
          {student.photoUrl && (
            <AvatarImage src={student.photoUrl} alt={student.fullName} />
          )}
          <AvatarFallback className="text-lg font-bold">
            {getInitials(student.fullName)}
          </AvatarFallback>
        </Avatar>

        <div className="text-center mt-1 w-full px-1">
          <p className="font-semibold text-sm leading-tight line-clamp-2">
            {student.fullName}
          </p>
          {student.documentId && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {student.documentId}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons — pinned at bottom */}
      <div className="grid grid-cols-2 border-t mt-auto">
        <button
          type="button"
          disabled={disabled}
          onClick={onMarkAbsent}
          className={cn(
            "flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-r transition-colors",
            status === "absent"
              ? "bg-red-500 text-white"
              : "text-red-600 hover:bg-red-50 disabled:opacity-40"
          )}
        >
          <X className="h-4 w-4" />
          Inasistente
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onMarkPresent}
          className={cn(
            "flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
            status === "present"
              ? "bg-green-500 text-white"
              : "text-green-600 hover:bg-green-50 disabled:opacity-40"
          )}
        >
          <Check className="h-4 w-4" />
          Asistente
        </button>
      </div>
    </div>
  );
}
