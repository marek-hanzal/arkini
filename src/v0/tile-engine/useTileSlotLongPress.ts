import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace useTileSlotLongPress {
	export interface Props {
		disabled: boolean;
		onLongActivate?: () => void;
	}

	export interface Result {
		onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
		onPointerLeave(event: ReactPointerEvent<HTMLDivElement>): void;
		onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void;
		onPointerCancel(event: ReactPointerEvent<HTMLDivElement>): void;
	}
}

export const useTileSlotLongPress = ({
	disabled,
	onLongActivate,
}: useTileSlotLongPress.Props): useTileSlotLongPress.Result => {
	const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activePointerIdRef = useRef<number | null>(null);

	const clearLongTimer = useCallback(() => {
		if (!longTimerRef.current) return;
		clearTimeout(longTimerRef.current);
		longTimerRef.current = null;
	}, []);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (disabled || !onLongActivate || event.button !== 0) return;

			activePointerIdRef.current = event.pointerId;
			clearLongTimer();
			longTimerRef.current = setTimeout(() => {
				if (activePointerIdRef.current !== event.pointerId) return;

				longTimerRef.current = null;
				onLongActivate();
			}, TileEngineTiming.longPressMs);
		},
		[
			clearLongTimer,
			disabled,
			onLongActivate,
		],
	);

	const cancelPointerLongPress = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (activePointerIdRef.current !== event.pointerId) return;

			activePointerIdRef.current = null;
			clearLongTimer();
		},
		[
			clearLongTimer,
		],
	);

	useEffect(
		() => () => {
			activePointerIdRef.current = null;
			clearLongTimer();
		},
		[
			clearLongTimer,
		],
	);

	return {
		onPointerDown,
		onPointerLeave: cancelPointerLongPress,
		onPointerUp: cancelPointerLongPress,
		onPointerCancel: cancelPointerLongPress,
	};
};
