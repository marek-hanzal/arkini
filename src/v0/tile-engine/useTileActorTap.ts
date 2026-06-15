import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { distance } from "~/v0/tile-engine/distance";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileActorTap {
	export interface Props<TDrag = unknown> {
		bindingRef: RefObject<TileEngine.DragBinding<TDrag> | undefined>;
		lastTapRef: RefObject<TileEngineActor.LastTap | null>;
		singleTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
		clearSingleTimer(): void;
	}
}

export const useTileActorTap = <TDrag>({
	bindingRef,
	lastTapRef,
	singleTimerRef,
	clearSingleTimer,
}: useTileActorTap.Props<TDrag>) =>
	useCallback(
		(event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">) => {
			const binding = bindingRef.current;
			if (!binding) return;
			if (!binding.onDoubleActivate) {
				binding.onSingleActivate?.();
				return;
			}

			const now = Date.now();
			const lastTap = lastTapRef.current;
			const isDouble = Boolean(
				lastTap &&
					now - lastTap.time <= TileEngineTiming.doubleTapWindowMs &&
					distance(event.clientX - lastTap.x, event.clientY - lastTap.y) <=
						TileEngineTiming.dragThresholdPx,
			);

			if (isDouble) {
				lastTapRef.current = null;
				clearSingleTimer();
				binding.onDoubleActivate();
				return;
			}

			lastTapRef.current = {
				time: now,
				x: event.clientX,
				y: event.clientY,
			};

			if (!binding.onSingleActivate) return;
			if (!binding.delaySingleWhenDouble) {
				binding.onSingleActivate();
				return;
			}

			clearSingleTimer();
			singleTimerRef.current = setTimeout(() => {
				singleTimerRef.current = null;
				bindingRef.current?.onSingleActivate?.();
			}, TileEngineTiming.doubleTapWindowMs);
		},
		[
			bindingRef,
			clearSingleTimer,
			lastTapRef,
			singleTimerRef,
		],
	);
