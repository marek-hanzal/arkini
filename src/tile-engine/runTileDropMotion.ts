import { animateDropRemove } from "~/tile-engine/animateDropRemove";
import { animateElementToRect } from "~/tile-engine/animateElementToRect";
import { createTileDropHandoffs } from "~/tile-engine/createTileDropHandoffs";
import { findTileEngineActorElement } from "~/tile-engine/findTileEngineActorElement";
import { rectFromElement } from "~/tile-engine/rect";
import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace runTileDropMotion {
	export interface Props<TTile = unknown, TSlot = unknown, TDrag = unknown, TDrop = unknown> {
		sourceElement: HTMLElement | null;
		session: TileEngineActor.DragSession<TDrag>;
		sourceTile: TileEngine.Tile<TTile>;
		resolved: TileEngineDrop.Resolved<TSlot, TTile, TDrop>;
		motionId: string;
		animation: TileEngine.DropAnimation | undefined;
		animateToTarget(targetRect: TileEngine.Rect | null): Promise<boolean>;
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

	if (animation === "remove") {
		const sourceMotionCompleted = await animateToTarget(rectFromElement(resolved.element));
		if (!sourceMotionCompleted) {
			return {
				completed: false,
				handoffs: [],
			};
		}

		return {
			completed: await animateDropRemove({
				element: sourceElement,
				tileId: sourceTile.id,
			}),
			handoffs: [],
		};
	}

	const [sourceMotionCompleted, targetMotionCompleted] = await Promise.all([
		animateToTarget(rectFromElement(resolved.element)),
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
		return {
			completed: false,
			handoffs: [],
		};
	}

	return {
		completed: true,
		handoffs: createTileDropHandoffs({
			sourceTile,
			resolved,
			includeTarget: Boolean(targetActorElement),
		}).all,
	};
};
