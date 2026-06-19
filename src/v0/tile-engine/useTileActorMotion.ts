import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { type RefObject, useCallback } from "react";
import { startTileTransformMotion, tileMotionScope } from "~/v0/tile-engine/TileMotionRuntime";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { useTileActorLayoutMotion } from "~/v0/tile-engine/useTileActorLayoutMotion";

export namespace useTileActorMotion {
	export interface Props<TTile = unknown, TDrag = unknown> {
		actorRef: RefObject<HTMLDivElement | null>;
		dragSessionRef: RefObject<TileEngineActor.DragSession<TDrag> | null>;
		tile: TileEngine.Tile<TTile>;
		dragging: boolean;
		consumeHandoff(tileId: string, slotId: string): boolean;
	}

	export interface MotionMeta {
		motionId?: string;
		animation?: TileEngine.DropAnimation;
		role?: "source" | "target";
		fromSlotId?: string;
		toSlotId?: string;
	}

	export interface Result {
		animateBack(): Promise<boolean>;
		animateToTarget(targetRect: TileEngine.Rect | null, meta?: MotionMeta): Promise<boolean>;
	}
}

export const useTileActorMotion = <TTile, TDrag>({
	actorRef,
	dragSessionRef,
	tile,
	dragging,
	consumeHandoff,
}: useTileActorMotion.Props<TTile, TDrag>): useTileActorMotion.Result => {
	useTileActorLayoutMotion({
		actorRef,
		tile,
		dragging,
		consumeHandoff,
	});

	const animateBack = useCallback(async () => {
		const session = dragSessionRef.current;
		const element = actorRef.current;
		if (!session || !element) return false;
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
		const result = await startTileTransformMotion({
			scope: tileMotionScope(tile.id),
			element,
			from: (snapshot) => translate3d(snapshot.translateX, snapshot.translateY),
			to: translate3d(0, 0),
			duration: TileEngineTiming.rejectDurationSeconds,
			ease: TileEngineTiming.rejectEase,
			meta: {
				kind: "reject",
				tileId: tile.id,
				slotId: tile.slotId,
			},
		});
		if (result.status !== "completed") return false;
		DebugTimeline.record({
			scope: "tile-engine",
			event: "motion.reject.end",
			detail: {
				tileId: tile.id,
				slotId: tile.slotId,
			},
		});
		return true;
	}, [
		actorRef,
		dragSessionRef,
		tile.id,
		tile.slotId,
	]);

	const animateToTarget = useCallback(
		async (targetRect: TileEngine.Rect | null, meta: useTileActorMotion.MotionMeta = {}) => {
			const session = dragSessionRef.current;
			const element = actorRef.current;
			if (!session || !element || !targetRect) return false;

			const target = targetDelta({
				origin: session.origin,
				target: targetRect,
			});

			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.snap.start",
				detail: {
					motionId: meta.motionId,
					animation: meta.animation,
					role: meta.role ?? "source",
					tileId: tile.id,
					fromSlotId: meta.fromSlotId ?? tile.slotId,
					toSlotId: meta.toSlotId,
					slotId: tile.slotId,
					fromX: session.currentX,
					fromY: session.currentY,
					targetX: target.x,
					targetY: target.y,
					targetRect,
				},
			});
			const result = await startTileTransformMotion({
				scope: tileMotionScope(tile.id),
				element,
				from: (snapshot) => translate3d(snapshot.translateX, snapshot.translateY),
				to: translate3d(target.x, target.y),
				duration: TileEngineTiming.snapDurationSeconds,
				ease: TileEngineTiming.moveEase,
				meta: {
					kind: "snap",
					...meta,
					tileId: tile.id,
				},
			});
			session.currentX = result.snapshot.translateX;
			session.currentY = result.snapshot.translateY;
			if (result.status !== "completed") return false;
			session.currentX = target.x;
			session.currentY = target.y;
			DebugTimeline.record({
				scope: "tile-engine",
				event: "motion.snap.end",
				detail: {
					motionId: meta.motionId,
					animation: meta.animation,
					role: meta.role ?? "source",
					tileId: tile.id,
					fromSlotId: meta.fromSlotId ?? tile.slotId,
					toSlotId: meta.toSlotId,
					slotId: tile.slotId,
					targetX: target.x,
					targetY: target.y,
				},
			});
			return true;
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
