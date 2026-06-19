import { type RefObject, useLayoutEffect, useRef } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import {
	cancelTileMotion,
	startTileTransformMotion,
	tileMotionScope,
} from "~/v0/tile-engine/TileMotionRuntime";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";

export namespace useTileActorLayoutMotion {
	export interface Props<TTile = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		tile: TileEngine.Tile<TTile>;
		dragging: boolean;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}
}

export const useTileActorLayoutMotion = <TTile>({
	actorRef,
	tile,
	dragging,
	consumeHandoff,
}: useTileActorLayoutMotion.Props<TTile>) => {
	const previousRectRef = useRef<TileEngine.Rect | null>(null);
	const previousSlotIdRef = useRef(tile.slotId);

	useLayoutEffect(() => {
		const element = actorRef.current;
		if (!element) return;

		if (consumeHandoff(tile.id, tile.slotId)) {
			cancelTileMotion(tileMotionScope(tile.id), "handoff");
			resetElementTransform(element);
			previousRectRef.current = rectFromElement(element);
			previousSlotIdRef.current = tile.slotId;
			return;
		}

		const current = rectFromElement(element);
		const previous = previousRectRef.current;
		const previousSlotId = previousSlotIdRef.current;
		previousRectRef.current = current;
		previousSlotIdRef.current = tile.slotId;

		if (!previous || previousSlotId === tile.slotId || dragging) return;

		const deltaX = previous.left - current.left;
		const deltaY = previous.top - current.top;
		if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.layout.start",
			detail: {
				tileId: tile.id,
				fromSlotId: previousSlotId,
				toSlotId: tile.slotId,
				deltaX,
				deltaY,
			},
		});

		void startTileTransformMotion({
			scope: tileMotionScope(tile.id),
			element,
			from: translate3d(deltaX, deltaY),
			to: translate3d(0, 0),
			duration: TileEngineTiming.moveDurationSeconds,
			ease: TileEngineTiming.moveEase,
			meta: {
				kind: "layout",
				tileId: tile.id,
				fromSlotId: previousSlotId,
				toSlotId: tile.slotId,
			},
		}).then((result) => {
			if (result.status !== "completed") return;
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.layout.end",
				detail: {
					tileId: tile.id,
					toSlotId: tile.slotId,
				},
			});
		});
	}, [
		actorRef,
		consumeHandoff,
		dragging,
		tile.id,
		tile.slotId,
	]);
};
