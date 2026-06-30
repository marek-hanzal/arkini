import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import { cancelTileMotion, tileMotionScope } from "~/v0/tile-engine/TileMotionRuntime";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTilePointerDown {
	export interface Props<TTile = unknown, TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		bindingRef: RefObject<TileEngine.DragBinding<TDrag> | undefined>;
		tileRef: RefObject<TileEngine.Tile<TTile>>;
		disabledRef: RefObject<boolean>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, unknown, TDrag, unknown> | undefined>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		longTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
		clearTimers(): void;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
	}
}

export const useTilePointerDown = <TTile, TDrag>({
	actorRef,
	bindingRef,
	tileRef,
	disabledRef,
	dragRef,
	dragConstraintsRef,
	dragSessionRef,
	longTimerRef,
	clearTimers,
	setHandoff,
}: useTilePointerDown.Props<TTile, TDrag>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (disabledRef.current || event.button !== 0) return;

			const binding = dragRef.current?.tile(tileRef.current);
			bindingRef.current = binding;
			const element = actorRef.current;
			if (!element || !binding || binding.disabled) return;

			const constraints = dragConstraintsRef?.current;
			if (constraints && !constraints.contains(event.currentTarget)) return;

			clearTimers();
			setHandoff(null);
			cancelTileMotion(tileMotionScope(tileRef.current.id), "pointer-down");
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

					bindingRef.current?.onLongActivate?.();
				}, TileEngineTiming.longPressMs);
			}
		},
		[
			actorRef,
			bindingRef,
			clearTimers,
			disabledRef,
			dragConstraintsRef,
			dragRef,
			dragSessionRef,
			longTimerRef,
			setHandoff,
			tileRef,
		],
	);
