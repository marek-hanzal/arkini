import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { clampDragDelta } from "~/tile-engine/clampDragDelta";
import { distance } from "~/tile-engine/distance";
import { isLiveDragSessionForPointer } from "~/tile-engine/isLiveDragSessionForPointer";
import { rectFromElement } from "~/tile-engine/rect";
import { translateElement } from "~/tile-engine/translateElement";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

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
			if (
				!session ||
				!isLiveDragSessionForPointer({
					pointerId: event.pointerId,
					session,
				})
			) {
				return;
			}

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
