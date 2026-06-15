import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTilePointerDown {
	export interface Props<TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		binding: TileEngine.DragBinding<TDrag> | undefined;
		disabled: boolean;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		longTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
		clearTimers(): void;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
	}
}

export const useTilePointerDown = <TDrag>({
	actorRef,
	binding,
	disabled,
	dragConstraintsRef,
	dragSessionRef,
	longTimerRef,
	clearTimers,
	setHandoff,
}: useTilePointerDown.Props<TDrag>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (disabled || event.button !== 0) return;
			const element = actorRef.current;
			if (!element || !binding) return;

			const constraints = dragConstraintsRef?.current;
			if (constraints && !constraints.contains(event.currentTarget)) return;

			clearTimers();
			setHandoff(null);
			resetElementTransform(element);
			element.setPointerCapture(event.pointerId);

			dragSessionRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				currentX: 0,
				currentY: 0,
				origin: rectFromElement(element),
				source: binding.data,
				started: false,
				longFired: false,
			};

			if (binding.onLongActivate) {
				longTimerRef.current = setTimeout(() => {
					const session = dragSessionRef.current;
					if (!session || session.pointerId !== event.pointerId || session.started) {
						return;
					}
					session.longFired = true;
					longTimerRef.current = null;
					binding.onLongActivate?.();
				}, TileEngineTiming.longPressMs);
			}
		},
		[
			actorRef,
			binding,
			clearTimers,
			disabled,
			dragConstraintsRef,
			dragSessionRef,
			longTimerRef,
			setHandoff,
		],
	);
