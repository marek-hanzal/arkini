import { useEffect, useRef } from "react";
import { usePress, type PressEvent, type PressResult } from "@react-aria/interactions";

const doublePressMs = 320;
const doublePressDistancePx = 24;

export namespace usePressActions {
  export interface Props {
    onSingle?(): void;
    onDouble?(): void;
    delaySingleWhenDouble?: boolean;
    isDisabled?: boolean;
  }

  export interface Result extends PressResult {}

  export interface LastPress {
    time: number;
    x: number;
    y: number;
    pointerType: PressEvent["pointerType"];
  }
}

// React Aria owns the ugly cross-browser press recognition. We only keep the
// tiny game rule on top: two nearby presses on the same target mean double press.
export function usePressActions({ onSingle, onDouble, delaySingleWhenDouble = false, isDisabled = false }: usePressActions.Props): usePressActions.Result {
  const lastPressRef = useRef<usePressActions.LastPress | null>(null);
  const singlePressTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => clearSinglePressTimeout(), []);

  const press = usePress({
    isDisabled,
    preventFocusOnPress: true,
    shouldCancelOnPointerExit: true,
    onPress(event) {
      const now = Date.now();
      const previous = lastPressRef.current;
      const isNearbyDouble = Boolean(
        previous
          && onDouble
          && previous.pointerType === event.pointerType
          && now - previous.time <= doublePressMs
          && Math.abs(event.x - previous.x) <= doublePressDistancePx
          && Math.abs(event.y - previous.y) <= doublePressDistancePx,
      );

      if (isNearbyDouble) {
        clearSinglePressTimeout();
        lastPressRef.current = null;
        onDouble?.();
        return;
      }

      if (onDouble) {
        lastPressRef.current = {
          time: now,
          x: event.x,
          y: event.y,
          pointerType: event.pointerType,
        };
      }

      if (!onSingle) return;

      if (onDouble && delaySingleWhenDouble) {
        clearSinglePressTimeout();
        singlePressTimeoutRef.current = window.setTimeout(() => {
          singlePressTimeoutRef.current = null;
          lastPressRef.current = null;
          onSingle();
        }, doublePressMs);
        return;
      }

      onSingle();
    },
  });

  return press;

  function clearSinglePressTimeout() {
    if (singlePressTimeoutRef.current === null) return;
    window.clearTimeout(singlePressTimeoutRef.current);
    singlePressTimeoutRef.current = null;
  }
}
