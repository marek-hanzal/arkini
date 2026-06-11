import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

const doubleTapMs = 320;
const singleDelayMs = 230;
const moveTolerancePx = 8;

export interface PressActions {
  onSingle?(): void;
  onDouble?(): void;
}

// Pointer/click glue for game tiles. It deliberately delays the single action a
// hair so a double action can cancel it. Otherwise double-clicking a producer
// would first fire the producer and then pause/open it, because browsers enjoy
// small acts of procedural cruelty.
export function usePressActions({ onSingle, onDouble }: PressActions) {
  const singleTimerRef = useRef<number | null>(null);
  const lastTapMsRef = useRef(0);
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => () => clearSingleTimer(), []);

  function clearSingleTimer() {
    if (singleTimerRef.current === null) return;
    window.clearTimeout(singleTimerRef.current);
    singleTimerRef.current = null;
  }

  function scheduleSingle() {
    if (!onSingle) return;
    clearSingleTimer();
    singleTimerRef.current = window.setTimeout(() => {
      singleTimerRef.current = null;
      onSingle();
    }, singleDelayMs);
  }

  function runDouble() {
    clearSingleTimer();
    onDouble?.();
  }

  function movedPastTolerance(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    if (!start) return false;
    return Math.abs(event.clientX - start.x) > moveTolerancePx || Math.abs(event.clientY - start.y) > moveTolerancePx;
  }

  return {
    onClick(event: ReactMouseEvent<HTMLElement>) {
      event.stopPropagation();
      if (Date.now() < suppressClickUntilRef.current) return;
      if (movedRef.current) {
        movedRef.current = false;
        return;
      }
      if (event.detail !== 1) return;
      scheduleSingle();
    },
    onDoubleClick(event: ReactMouseEvent<HTMLElement>) {
      event.preventDefault();
      event.stopPropagation();
      runDouble();
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
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" || movedRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      suppressClickUntilRef.current = Date.now() + 500;

      const now = Date.now();
      if (now - lastTapMsRef.current <= doubleTapMs) {
        lastTapMsRef.current = 0;
        runDouble();
        return;
      }

      lastTapMsRef.current = now;
      scheduleSingle();
    },
  };
}
