import { type Dispatch, type RefObject, type SetStateAction, useCallback } from "react";
import { resetElementTransform } from "~/tile-engine/resetElementTransform";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useTileDragLifecycle {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tileRef: RefObject<TileEngine.Tile<TTile>>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		clearTimers(): void;
		setActiveDropId(dropId: string | null): void;
		setDragging: Dispatch<SetStateAction<boolean>>;
		setHandoff(handoff: TileEngineActor.Handoff | null): void;
	}

	export interface Result {
		finishDrag(): void;
		cancelDrag(): void;
		startActualDrag(): void;
	}
}

export const useTileDragLifecycle = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	tileRef,
	dragRef,
	clearTimers,
	setActiveDropId,
	setDragging,
	setHandoff,
}: useTileDragLifecycle.Props<TTile, TSlot, TDrag, TDrop>): useTileDragLifecycle.Result => {
	const finishDrag = useCallback(() => {
		actorRef.current?.removeAttribute("data-ak-tile-engine-dragging");
		dragSessionRef.current = null;
		setDragging(false);
		setActiveDropId(null);
	}, [
		actorRef,
		dragSessionRef,
		setActiveDropId,
		setDragging,
	]);

	const cancelDrag = useCallback(() => {
		const session = dragSessionRef.current;
		if (session?.started) {
			dragRef.current?.onDragCancel?.({
				source: session.source,
				tile: tileRef.current,
			});
		}
		clearTimers();
		setHandoff(null);
		finishDrag();
		resetElementTransform(actorRef.current);
	}, [
		actorRef,
		clearTimers,
		dragRef,
		dragSessionRef,
		finishDrag,
		setHandoff,
		tileRef,
	]);

	const startActualDrag = useCallback(() => {
		const session = dragSessionRef.current;
		if (!session || session.started) return;
		session.started = true;

		clearTimers();
		actorRef.current?.setAttribute("data-ak-tile-engine-dragging", "true");
		setDragging(true);
		dragRef.current?.onDragStart?.({
			source: session.source,
			tile: tileRef.current,
			rect: session.origin,
		});
	}, [
		actorRef,
		clearTimers,
		dragRef,
		dragSessionRef,
		setDragging,
		tileRef,
	]);

	return {
		finishDrag,
		cancelDrag,
		startActualDrag,
	};
};
