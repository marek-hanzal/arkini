import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const moveTolerancePx = 3;
const doubleTapMs = 320;
const doubleTapDistancePx = 24;

export interface PressActions {
  onSingle?(): void;
  onDouble?(): void;
}

// Click activation stays immediate. Double activation is detected on pointer-up
// without delaying the single click, so producer clicks cannot become haunted
// timer events that move a tile later. Computers needed supervision again.
export function usePressActions({ onSingle, onDouble }: PressActions) {
  const movedRef = useRef(false);
  const doubleActivatedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  function markMove(clientX: number, clientY: number) {
    const start = pointerStartRef.current;
    if (!start) return;
    if (Math.abs(clientX - start.x) > moveTolerancePx || Math.abs(clientY - start.y) > moveTolerancePx) {
      movedRef.current = true;
    }
  }

  function maybeDoubleActivate(clientX: number, clientY: number) {
    if (!onDouble || movedRef.current) return;

    const now = Date.now();
    const previous = lastTapRef.current;
    const closeEnough = previous
      && now - previous.time <= doubleTapMs
      && Math.abs(clientX - previous.x) <= doubleTapDistancePx
      && Math.abs(clientY - previous.y) <= doubleTapDistancePx;

    if (!closeEnough) {
      lastTapRef.current = { time: now, x: clientX, y: clientY };
      return;
    }

    lastTapRef.current = null;
    doubleActivatedRef.current = true;
    onDouble();
  }

  return {
    onClick(event: ReactMouseEvent<HTMLElement>) {
      event.stopPropagation();
      if (event.detail > 1 || doubleActivatedRef.current) {
        doubleActivatedRef.current = false;
        movedRef.current = false;
        return;
      }
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
      maybeDoubleActivate(event.clientX, event.clientY);
      pointerStartRef.current = null;
    },
    onPointerCancel() {
      movedRef.current = true;
      pointerStartRef.current = null;
      lastTapRef.current = null;
    },
  };
}
