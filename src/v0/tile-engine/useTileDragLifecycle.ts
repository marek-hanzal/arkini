import { type Dispatch, type RefObject, type SetStateAction, useCallback } from "react";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileDragLifecycle {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tile: TileEngine.Tile<TTile>;
		drag?: TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop>;
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
	tile,
	drag,
	clearTimers,
	setActiveDropId,
	setDragging,
	setHandoff,
}: useTileDragLifecycle.Props<TTile, TSlot, TDrag, TDrop>): useTileDragLifecycle.Result => {
	const finishDrag = useCallback(() => {
		dragSessionRef.current = null;
		setDragging(false);
		setActiveDropId(null);
	}, [
		dragSessionRef,
		setActiveDropId,
		setDragging,
	]);

	const cancelDrag = useCallback(() => {
		const session = dragSessionRef.current;
		if (session?.started) {
			drag?.onDragCancel?.({
				source: session.source,
				tile,
			});
		}
		clearTimers();
		setHandoff(null);
		finishDrag();
		resetElementTransform(actorRef.current);
	}, [
		actorRef,
		clearTimers,
		drag,
		dragSessionRef,
		finishDrag,
		setHandoff,
		tile,
	]);

	const startActualDrag = useCallback(() => {
		const session = dragSessionRef.current;
		if (!session || session.started) return;
		session.started = true;
		clearTimers();
		setDragging(true);
		drag?.onDragStart?.({
			source: session.source,
			tile,
			rect: session.origin,
		});
	}, [
		clearTimers,
		drag,
		dragSessionRef,
		setDragging,
		tile,
	]);

	return {
		finishDrag,
		cancelDrag,
		startActualDrag,
	};
};
