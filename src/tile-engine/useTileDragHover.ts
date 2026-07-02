import { type RefObject, useCallback, useRef } from "react";
import { dragSessionRect } from "~/tile-engine/dragSessionRect";
import { rectFromElement } from "~/tile-engine/rect";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace useTileDragHover {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		dragRef: RefObject<TileEngine.DragConfig<TTile, TSlot, TDrag, TDrop> | undefined>;
		resolveDrop(rect: TileEngine.Rect): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null;
		setActiveDropId(dropId: string | null): void;
		setActiveDropFeedback(feedback: TileEngine.ActiveDropFeedback | null): void;
	}
}

export const useTileDragHover = <TTile, TSlot, TDrag, TDrop>({
	actorRef,
	dragSessionRef,
	dragRef,
	resolveDrop,
	setActiveDropId,
	setActiveDropFeedback,
}: useTileDragHover.Props<TTile, TSlot, TDrag, TDrop>) => {
	const lastDropIdRef = useRef<string | null>(null);
	const lastFeedbackKeyRef = useRef<string | null>(null);

	return useCallback(() => {
		const session = dragSessionRef.current;
		if (!session || !session.started) return null;

		const element = actorRef.current;
		const rect = element ? rectFromElement(element) : dragSessionRect(session);
		const resolved = resolveDrop(rect);
		const nextDropId = resolved?.dropId ?? null;
		const context: TileEngine.DragOverContext<TTile, TSlot, TDrag, TDrop> = {
			source: session.source,
			target: resolved?.payload ?? null,
			targetSlot: resolved?.slot ?? null,
			targetTile: resolved?.targetTile ?? null,
			dropId: nextDropId,
		};
		const feedback =
			nextDropId && dragRef.current?.dropFeedback
				? dragRef.current.dropFeedback(context)
				: null;
		const activeFeedback: TileEngine.ActiveDropFeedback | null =
			nextDropId && feedback
				? {
						dropId: nextDropId,
						targetTileId: resolved?.targetTile?.id,
						...feedback,
					}
				: null;
		const sourceElement = actorRef.current;
		const sourceTileId = sourceElement?.dataset.akTileEngineTileId;
		const sourceSlotId = sourceElement?.dataset.akTileEngineSlotId;
		const feedbackKey = activeFeedback
			? `${session.pointerId}:${activeFeedback.dropId}:${activeFeedback.targetTileId ?? ""}:${activeFeedback.effect}:${activeFeedback.variant ?? ""}`
			: `${session.pointerId}:${nextDropId ?? "none"}:none`;

		if (lastDropIdRef.current !== nextDropId) {
			lastDropIdRef.current = nextDropId;
		}

		if (lastFeedbackKeyRef.current !== feedbackKey) {
			const previousFeedbackKey = lastFeedbackKeyRef.current;
			lastFeedbackKeyRef.current = feedbackKey;
		}

		setActiveDropId(nextDropId);
		setActiveDropFeedback(activeFeedback);
		dragRef.current?.onDragOver?.(context);
		return resolved;
	}, [
		actorRef,
		dragRef,
		dragSessionRef,
		resolveDrop,
		setActiveDropId,
		setActiveDropFeedback,
	]);
};
