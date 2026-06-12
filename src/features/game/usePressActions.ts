import { useRef } from "react";
import { usePress, type PressEvent, type PressResult } from "@react-aria/interactions";

const doublePressMs = 320;
const doublePressDistancePx = 24;

type LastPress = {
  time: number;
  x: number;
  y: number;
  pointerType: PressEvent["pointerType"];
};

export interface PressActions {
  onSingle?(): void;
  onDouble?(): void;
  isDisabled?: boolean;
}

export interface PressActionResult extends PressResult {}

// React Aria owns the ugly cross-browser press recognition. We only keep the
// tiny game rule on top: two nearby presses on the same target mean double press.
export function usePressActions({ onSingle, onDouble, isDisabled = false }: PressActions): PressActionResult {
  const lastPressRef = useRef<LastPress | null>(null);

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

      onSingle?.();
    },
  });

  return press;
}
