import { type RefObject, useCallback, useRef } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { dragSessionRect } from "~/v0/tile-engine/dragSessionRect";
import { rectFromElement } from "~/v0/tile-engine/rect";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileDragHover {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
	}
}

export const useTileDragHover = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	dragRef,
	resolveDrop,
	setActiveDropId,
}: useTileDragHover.Props<TTile, TSlot, TDrag, TDrop>) => {
	const lastDropIdRef = useRef<string | null>(null);

	return useCallback(() => {
		const session = dragSessionRef.current;
		if (!session || !session.started) return null;

		const element = actorRef.current;
		const rect = element ? rectFromElement(element) : dragSessionRect(session);
		const resolved = resolveDrop(rect);
		const nextDropId = resolved?.dropId ?? null;
		if (lastDropIdRef.current !== nextDropId) {
			lastDropIdRef.current = nextDropId;
			DebugTimeline.record({
				scope: "tile-engine",
				event: "drop.hover",
				detail: {
					dropId: nextDropId,
					source: session.source,
					target: resolved?.payload ?? null,
					hasSlot: Boolean(resolved?.slot),
					hasTargetTile: Boolean(resolved?.targetTile),
				},
			});
		}
		setActiveDropId(nextDropId);
		dragRef.current?.onDragOver?.({
			source: session.source,
			target: resolved?.payload ?? null,
			targetSlot: resolved?.slot ?? null,
			targetTile: resolved?.targetTile ?? null,
			dropId: resolved?.dropId ?? null,
		});
		return resolved;
	}, [
		actorRef,
		dragRef,
		dragSessionRef,
		resolveDrop,
		setActiveDropId,
	]);
};
