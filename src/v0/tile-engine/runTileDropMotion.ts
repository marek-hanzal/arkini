import { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import { animateElementToRect } from "~/v0/tile-engine/animateElementToRect";
import { createTileDropHandoffs } from "~/v0/tile-engine/createTileDropHandoffs";
import { findTileEngineActorElement } from "~/v0/tile-engine/findTileEngineActorElement";
import { rectFromElement } from "~/v0/tile-engine/rect";
import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace runTileDropMotion {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		sourceElement: HTMLElement | null;
		session: TileEngineActor.DragSession<TDrag>;
		sourceTile: TileEngine.Tile<TTile>;
		resolved: TileEngineDrop.Resolved<TSlot, TTile, TDrop>;
		motionId: string;
		animation: TileEngine.DropAnimation | undefined;
		animateToTarget(
			targetRect: TileEngine.Rect | null,
			meta?: {
				motionId?: string;
				animation?: TileEngine.DropAnimation;
				role?: "source" | "target";
				fromSlotId?: string;
				toSlotId?: string;
			},
		): Promise<boolean>;
	}

	export interface Result {
		completed: boolean;
		handoffs: readonly TileEngineActor.Handoff[];
	}
}

export const runTileDropMotion = async <TTile, TSlot, TDrag, TDrop>({
	sourceElement,
	session,
	sourceTile,
	resolved,
	motionId,
	animation,
	animateToTarget,
}: runTileDropMotion.Props<TTile, TSlot, TDrag, TDrop>): Promise<runTileDropMotion.Result> => {
	const targetActorElement =
		animation === "parallel-swap" && sourceElement && resolved.targetTile
			? findTileEngineActorElement({
					sourceElement,
					tileId: resolved.targetTile.id,
				})
			: null;

	DebugTimeline.record({
		scope: "tile-engine",
		event: "drop.motion.start",
		detail: {
			motionId,
			animation,
			sourceTileId: sourceTile.id,
			sourceFromSlotId: sourceTile.slotId,
			sourceToSlotId: resolved.slot?.id,
			targetTileId: resolved.targetTile?.id,
			targetFromSlotId: resolved.targetTile?.slotId,
			targetToSlotId: sourceTile.slotId,
			parallel: Boolean(targetActorElement),
		},
	});

	const [sourceMotionCompleted, targetMotionCompleted] = await Promise.all([
		animateToTarget(rectFromElement(resolved.element), {
			motionId,
			animation,
			role: "source",
			fromSlotId: sourceTile.slotId,
			toSlotId: resolved.slot?.id,
		}),
		targetActorElement
			? animateElementToRect({
					element: targetActorElement,
					target: session.origin,
					meta: {
						motionId,
						animation,
						role: "target",
						tileId: resolved.targetTile?.id,
						fromSlotId: resolved.targetTile?.slotId,
						toSlotId: sourceTile.slotId,
					},
				})
			: Promise.resolve(true),
	]);

	if (!sourceMotionCompleted || (targetActorElement && !targetMotionCompleted)) {
		DebugTimeline.record({
			scope: "tile-engine",
			event: "drop.motion.cancelled",
			detail: {
				motionId,
				animation,
				sourceMotionCompleted,
				targetMotionCompleted,
			},
		});
		return {
			completed: false,
			handoffs: [],
		};
	}

	DebugTimeline.record({
		scope: "tile-engine",
		event: "drop.motion.end",
		detail: {
			motionId,
			animation,
			parallel: Boolean(targetActorElement),
		},
	});

	return {
		completed: true,
		handoffs: createTileDropHandoffs({
			sourceTile,
			resolved,
			includeTarget: Boolean(targetActorElement),
		}).all,
	};
};
