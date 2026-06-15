import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import { distance } from "~/v0/tile-engine/distance";
import { translateElement } from "~/v0/tile-engine/translateElement";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";

export namespace useTilePointerMove {
	export interface Props<TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		clearLongTimer(): void;
		startActualDrag(): void;
		updateHover(): unknown;
	}
}

export const useTilePointerMove = <TDrag>({
	actorRef,
	dragSessionRef,
	clearLongTimer,
	startActualDrag,
	updateHover,
}: useTilePointerMove.Props<TDrag>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== event.pointerId) return;

			const x = event.clientX - session.startX;
			const y = event.clientY - session.startY;
			session.currentX = x;
			session.currentY = y;

			if (!session.started) {
				const moved = distance(x, y);
				if (moved <= TileEngineTiming.dragThresholdPx) return;
				startActualDrag();
			}

			if (!dragSessionRef.current?.started) return;
			clearLongTimer();
			translateElement(actorRef.current, x, y);
			updateHover();
		},
		[
			actorRef,
			clearLongTimer,
			dragSessionRef,
			startActualDrag,
			updateHover,
		],
	);
