import { useEffect, useRef } from "react";
import { DateTime } from "luxon";
import { usePress, type PressEvent, type PressResult } from "@react-aria/interactions";

const doublePressMs = 320;
const doublePressDistancePx = 24;
const longPressMs = 520;

export namespace usePressActions {
	export interface Props {
		onSingle?(): void;
		onDouble?(): void;
		onLong?(): void;
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
export function usePressActions({
	onSingle,
	onDouble,
	onLong,
	delaySingleWhenDouble = false,
	isDisabled = false,
}: usePressActions.Props): usePressActions.Result {
	const lastPressRef = useRef<usePressActions.LastPress | null>(null);
	const singlePressTimeoutRef = useRef<number | null>(null);
	const longPressTimeoutRef = useRef<number | null>(null);
	const longPressTriggeredRef = useRef(false);

	useEffect(
		() => () => {
			clearSinglePressTimeout();
			clearLongPressTimeout();
		},
		[],
	);

	const press = usePress({
		isDisabled,
		preventFocusOnPress: true,
		shouldCancelOnPointerExit: true,
		onPressStart() {
			if (!onLong) return;

			clearLongPressTimeout();
			longPressTriggeredRef.current = false;
			longPressTimeoutRef.current = window.setTimeout(() => {
				longPressTimeoutRef.current = null;
				longPressTriggeredRef.current = true;
				lastPressRef.current = null;
				clearSinglePressTimeout();
				onLong();
			}, longPressMs);
		},
		onPressEnd() {
			clearLongPressTimeout();
		},
		onPress(event) {
			clearLongPressTimeout();
			if (longPressTriggeredRef.current) {
				longPressTriggeredRef.current = false;
				return;
			}
			const now = DateTime.now().toMillis();
			const previous = lastPressRef.current;
			const isNearbyDouble = Boolean(
				previous &&
					onDouble &&
					previous.pointerType === event.pointerType &&
					now - previous.time <= doublePressMs &&
					Math.abs(event.x - previous.x) <= doublePressDistancePx &&
					Math.abs(event.y - previous.y) <= doublePressDistancePx,
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

	function clearLongPressTimeout() {
		if (longPressTimeoutRef.current === null) return;
		window.clearTimeout(longPressTimeoutRef.current);
		longPressTimeoutRef.current = null;
	}
}
