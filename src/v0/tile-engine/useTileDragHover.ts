import { type RefObject, useCallback } from "react";
import { dragSessionRect } from "~/v0/tile-engine/dragSessionRect";
import { rectFromElement } from "~/v0/tile-engine/rect";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileDragHover {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		drag?: TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
	}
}

export const useTileDragHover = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	drag,
	resolveDrop,
	setActiveDropId,
}: useTileDragHover.Props<TTile, TSlot, TDrag, TDrop>) =>
	useCallback(() => {
		const session = dragSessionRef.current;
		if (!session || !session.started) return null;

		const element = actorRef.current;
		const rect = element ? rectFromElement(element) : dragSessionRect(session);
		const resolved = resolveDrop(rect);
		setActiveDropId(resolved?.dropId ?? null);
		drag?.onDragOver?.({
			source: session.source,
			target: resolved?.payload ?? null,
			targetSlot: resolved?.slot ?? null,
			targetTile: resolved?.targetTile ?? null,
			dropId: resolved?.dropId ?? null,
		});
		return resolved;
	}, [
		actorRef,
		drag,
		dragSessionRef,
		resolveDrop,
		setActiveDropId,
	]);
