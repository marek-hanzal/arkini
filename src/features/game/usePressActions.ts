import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const moveTolerancePx = 8;

export interface PressActions {
  onSingle?(): void;
}

// Tiny click guard shared by board and inventory cells. No timers, no delayed
// double-click ceremony, no haunted click that runs after the user already moved
// on with their life. Drag owns movement; click owns activation.
export function usePressActions({ onSingle }: PressActions) {
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  function movedPastTolerance(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    if (!start) return false;
    return Math.abs(event.clientX - start.x) > moveTolerancePx || Math.abs(event.clientY - start.y) > moveTolerancePx;
  }

  return {
    onClick(event: ReactMouseEvent<HTMLElement>) {
      event.stopPropagation();
      if (movedRef.current) {
        movedRef.current = false;
        return;
      }
      onSingle?.();
    },
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      movedRef.current = false;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (movedPastTolerance(event)) {
        movedRef.current = true;
      }
    },
    onPointerUp() {
      pointerStartRef.current = null;
    },
  };
}
