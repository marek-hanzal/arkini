import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback } from "react";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

export namespace useTilePointerCancel {
	export interface Props<TDrag = unknown> {
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		cancelDrag(): void;
	}
}

export const useTilePointerCancel = <TDrag>({
	dragSessionRef,
	cancelDrag,
}: useTilePointerCancel.Props<TDrag>) =>
	useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== event.pointerId) return;
			cancelDrag();
		},
		[
			cancelDrag,
			dragSessionRef,
		],
	);
