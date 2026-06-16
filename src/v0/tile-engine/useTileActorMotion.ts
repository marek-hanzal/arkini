import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { resetElementTransform } from "~/v0/tile-engine/resetElementTransform";
import {
	cancelTileMotion,
	startTileTransformMotion,
	tileMotionScope,
} from "~/v0/tile-engine/TileMotionRuntime";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";
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
