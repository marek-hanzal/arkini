import { useActorRef } from "@xstate/react";
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
// double press. The hook intentionally does not subscribe to the machine state:
// the press actor only fires callbacks and timers, so internal transitions must
// not re-render every board cell like a tiny denial-of-service attack with JSX.
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
	const actor = useActorRef(machine);
	const hasSingle = Boolean(onSingle);
	const hasDouble = Boolean(onDouble);
	const hasLong = Boolean(onLong);

	useEffect(() => {
		actor.send({
			type: "CONFIG_CHANGED",
			hasSingle,
			hasDouble,
			hasLong,
			delaySingleWhenDouble,
		});
	}, [
		actor,
		hasSingle,
		hasDouble,
		hasLong,
		delaySingleWhenDouble,
	]);

	const press = usePress({
		isDisabled,
		preventFocusOnPress: true,
		shouldCancelOnPointerExit: true,
		onPressStart() {
			actor.send({
				type: "PRESS_STARTED",
			});
		},
		onPressEnd() {
			actor.send({
				type: "PRESS_ENDED",
			});
		},
		onPress(event) {
			actor.send({
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
