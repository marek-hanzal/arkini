import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export function useDoubleActivate(onDoubleActivate: () => void) {
  const lastTapMsRef = useRef(0);
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse") return;
      movedRef.current = false;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse") return;
      const start = pointerStartRef.current;
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) {
        movedRef.current = true;
      }
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" || movedRef.current) return;
      const now = Date.now();
      if (now - lastTapMsRef.current <= 320) {
        lastTapMsRef.current = 0;
        event.preventDefault();
        event.stopPropagation();
        onDoubleActivate();
        return;
      }
      lastTapMsRef.current = now;
    },
  };
}
