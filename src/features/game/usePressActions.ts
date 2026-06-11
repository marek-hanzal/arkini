import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const moveTolerancePx = 3;

export interface PressActions {
  onSingle?(): void;
}

// Click activation is intentionally immediate. Drag detection only suppresses the
// click that browsers emit after a real drag; no delayed double-click timer is
// allowed here because haunted delayed clicks were moving tiles on later taps.
export function usePressActions({ onSingle }: PressActions) {
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  function markMove(clientX: number, clientY: number) {
    const start = pointerStartRef.current;
    if (!start) return;
    if (Math.abs(clientX - start.x) > moveTolerancePx || Math.abs(clientY - start.y) > moveTolerancePx) {
      movedRef.current = true;
    }
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
      markMove(event.clientX, event.clientY);
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      markMove(event.clientX, event.clientY);
      pointerStartRef.current = null;
    },
    onPointerCancel() {
      movedRef.current = true;
      pointerStartRef.current = null;
    },
  };
}
