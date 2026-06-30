import { DebugTimeline } from "~/v0/diagnostics/DebugTimeline";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { startTileTransformMotion, tileMotionScope } from "~/v0/tile-engine/TileMotionRuntime";
import { translate3d } from "~/v0/tile-engine/TileVisualSnapshot";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

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

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.peer-snap.start",
		detail: {
			...meta,
			fromRect,
			targetRect: target,
			deltaX: delta.x,
			deltaY: delta.y,
		},
	});

	const result = await startTileTransformMotion({
		scope: tileMotionScope(meta.tileId ?? `peer:${meta.motionId ?? "unknown"}`),
		element,
		from: (snapshot) => translate3d(snapshot.translateX, snapshot.translateY),
		to: (snapshot) => translate3d(snapshot.translateX + delta.x, snapshot.translateY + delta.y),
		duration: TileEngineTiming.snapDurationSeconds,
		ease: TileEngineTiming.moveEase,
		meta: {
			kind: "peer-snap",
			...meta,
		},
	});

	if (result.status !== "completed") return false;

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.peer-snap.end",
		detail: {
			...meta,
			targetRect: target,
		},
	});

	return true;
};
