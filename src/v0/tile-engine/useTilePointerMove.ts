import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { clampDragDelta } from "~/v0/tile-engine/clampDragDelta";
import { distance } from "~/v0/tile-engine/distance";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { translateElement } from "~/v0/tile-engine/translateElement";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";

export namespace useTilePointerMove {
	export interface Props<TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		dragConstraintsRef?: RefObject<HTMLElement | null>;
		clearLongTimer(): void;
		startActualDrag(): void;
		updateHover(): unknown;
	}
}

export const useTilePointerMove = <TDrag>({
	actorRef,
	dragSessionRef,
	dragConstraintsRef,
	clearLongTimer,
	startActualDrag,
	updateHover,
}: useTilePointerMove.Props<TDrag>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== event.pointerId) return;

			const rawX = event.clientX - session.startX;
			const rawY = event.clientY - session.startY;

			if (!session.started) {
				const moved = distance(rawX, rawY);
				if (moved <= TileEngineTiming.dragThresholdPx) return;
				startActualDrag();
			}

			if (!dragSessionRef.current?.started) return;
			clearLongTimer();

			const constraints = dragConstraintsRef?.current;
			const constraintsRect = constraints ? rectFromElement(constraints) : null;
			const { x, y } = clampDragDelta({
				x: rawX,
				y: rawY,
				origin: session.origin,
				bounds: constraintsRect,
			});
			session.currentX = x;
			session.currentY = y;
			translateElement(actorRef.current, x, y);
			updateHover();
		},
		[
			actorRef,
			clearLongTimer,
			dragConstraintsRef,
			dragSessionRef,
			startActualDrag,
			updateHover,
		],
	);
