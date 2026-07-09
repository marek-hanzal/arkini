import { rectFromElement } from "~/tile-engine/rect";
import { targetDelta } from "~/tile-engine/targetDelta";
import { startTileTransformMotion, tileMotionScope } from "~/tile-engine/TileMotionRuntime";
import { translate3d } from "~/tile-engine/TileVisualSnapshot";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace animateElementToRect {
	export interface Meta {
		motionId?: string;
		animation?: TileEngine.DropAnimation;
		role?: "source" | "target";
		tileId?: string;
		fromSlotId?: string;
		toSlotId?: string;
	}
}

export const animateElementToRect = async ({
	element,
	target,
	meta = {},
}: {
	element: HTMLElement;
	target: TileEngine.Rect;
	meta?: animateElementToRect.Meta;
}) => {
	const fromRect = rectFromElement(element);
	const delta = targetDelta({
		origin: fromRect,
		target,
	});

	const result = await startTileTransformMotion({
		scope: tileMotionScope(meta.tileId ?? `peer:${meta.motionId ?? "unknown"}`),
		element,
		from: (snapshot) => translate3d(snapshot.translateX, snapshot.translateY),
		to: (snapshot) => translate3d(snapshot.translateX + delta.x, snapshot.translateY + delta.y),
		duration: TileEngineTiming.snapDurationSeconds,
		ease: TileEngineTiming.moveEase,
	});

	if (result.status !== "completed") return false;

	return true;
};
