import { useMachine } from "@xstate/react";
import { useEffect, useMemo, useRef } from "react";
import { usePress, type PressEvent, type PressResult } from "@react-aria/interactions";
import { pressActionsMachine } from "~/shared/logic/pressActionsMachine";

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

// React Aria owns the ugly cross-browser press recognition. XState owns the
// small game workflow above it: long press, delayed single press, and nearby
// double press. Humans invented touchscreens, so somebody has to pay.
export function usePressActions({
	onSingle,
	onDouble,
	onLong,
	delaySingleWhenDouble = false,
	isDisabled = false,
}: usePressActions.Props): usePressActions.Result {
	const callbacksRef = useRef({
		onSingle,
		onDouble,
		onLong,
	});
	callbacksRef.current = {
		onSingle,
		onDouble,
		onLong,
	};

	const machine = useMemo(
		() =>
			pressActionsMachine.provide({
				actions: {
					callSingle: () => callbacksRef.current.onSingle?.(),
					callDouble: () => callbacksRef.current.onDouble?.(),
					callLong: () => callbacksRef.current.onLong?.(),
				},
			}),
		[],
	);
	const [, send] = useMachine(machine);

	useEffect(() => {
		send({
			type: "CONFIG_CHANGED",
			hasSingle: Boolean(onSingle),
			hasDouble: Boolean(onDouble),
			hasLong: Boolean(onLong),
			delaySingleWhenDouble,
		});
	}, [
		onSingle,
		onDouble,
		onLong,
		delaySingleWhenDouble,
		send,
	]);

	const press = usePress({
		isDisabled,
		preventFocusOnPress: true,
		shouldCancelOnPointerExit: true,
		onPressStart() {
			send({
				type: "PRESS_STARTED",
			});
		},
		onPressEnd() {
			send({
				type: "PRESS_ENDED",
			});
		},
		onPress(event) {
			send({
				type: "PRESS",
				time: Date.now(),
				x: event.x,
				y: event.y,
				pointerType: event.pointerType,
			});
		},
	});

	return press;
}
