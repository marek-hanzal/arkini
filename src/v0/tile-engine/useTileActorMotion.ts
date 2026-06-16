import { animate } from "motion";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace useTileActorMotion {
	export interface Props<TTile = unknown, TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tile: TileEngine.Tile<TTile>;
		dragging: boolean;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}

	export interface Result {
		animateBack(): Promise<void>;
		animateToTarget(targetRect: TileEngine.Rect | null): Promise<void>;
	}
}

export const useTileActorMotion = <TTile, TDrag>({
	actorRef,
	dragSessionRef,
	tile,
	dragging,
	consumeHandoff,
}: useTileActorMotion.Props<TTile, TDrag>): useTileActorMotion.Result => {
	const previousRectRef = useRef<TileEngine.Rect | null>(null);
	const previousSlotIdRef = useRef(tile.slotId);

	useLayoutEffect(() => {
		const element = actorRef.current;
		if (!element) return;

		if (consumeHandoff(tile.id, tile.slotId)) {
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

		void animate(
			element,
			{
				transform: [
					`translate3d(${deltaX}px, ${deltaY}px, 0px)`,
					"translate3d(0px, 0px, 0px)",
				],
			},
			{
				duration: TileEngineTiming.moveDurationSeconds,
				ease: TileEngineTiming.moveEase,
			},
		).then(() =>
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.layout.end",
				detail: {
					tileId: tile.id,
					toSlotId: tile.slotId,
				},
			}),
		);
	}, [
		actorRef,
		consumeHandoff,
		dragging,
		tile.id,
		tile.slotId,
	]);

	const animateBack = useCallback(async () => {
		const session = dragSessionRef.current;
		const element = actorRef.current;
		if (!session || !element) return;
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.reject.start",
			detail: {
				tileId: tile.id,
				slotId: tile.slotId,
				currentX: session.currentX,
				currentY: session.currentY,
			},
		});
		await animate(
			element,
			{
				transform: [
					`translate3d(${session.currentX}px, ${session.currentY}px, 0px)`,
					"translate3d(0px, 0px, 0px)",
				],
			},
			{
				duration: TileEngineTiming.rejectDurationSeconds,
				ease: TileEngineTiming.rejectEase,
			},
		);
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.reject.end",
			detail: {
				tileId: tile.id,
				slotId: tile.slotId,
			},
		});
	}, [
		actorRef,
		dragSessionRef,
		tile.id,
		tile.slotId,
	]);

	const animateToTarget = useCallback(
		async (targetRect: TileEngine.Rect | null) => {
			const session = dragSessionRef.current;
			const element = actorRef.current;
			if (!session || !element || !targetRect) return;

			const target = targetDelta({
				origin: session.origin,
				target: targetRect,
			});

			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.snap.start",
				detail: {
					tileId: tile.id,
					slotId: tile.slotId,
					fromX: session.currentX,
					fromY: session.currentY,
					targetX: target.x,
					targetY: target.y,
					targetRect,
				},
			});
			await animate(
				element,
				{
					transform: [
						`translate3d(${session.currentX}px, ${session.currentY}px, 0px)`,
						`translate3d(${target.x}px, ${target.y}px, 0px)`,
					],
				},
				{
					duration: TileEngineTiming.snapDurationSeconds,
					ease: TileEngineTiming.moveEase,
				},
			);
			session.currentX = target.x;
			session.currentY = target.y;
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.snap.end",
				detail: {
					tileId: tile.id,
					slotId: tile.slotId,
					targetX: target.x,
					targetY: target.y,
				},
			});
		},
		[
			actorRef,
			dragSessionRef,
			tile.id,
			tile.slotId,
		],
	);

	return {
		animateBack,
		animateToTarget,
	};
};
