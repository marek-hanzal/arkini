import { animate } from "motion";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
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
	const delta = targetDelta({
		origin: rectFromElement(element),
		target,
	});

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.peer-snap.start",
		detail: {
			...meta,
			fromRect: rectFromElement(element),
			targetRect: target,
			deltaX: delta.x,
			deltaY: delta.y,
		},
	});

	await animate(
		element,
		{
			transform: [
				"translate3d(0px, 0px, 0px)",
				`translate3d(${delta.x}px, ${delta.y}px, 0px)`,
			],
		},
		{
			duration: TileEngineTiming.snapDurationSeconds,
			ease: TileEngineTiming.moveEase,
		},
	);

	DebugTimeline.record({
		scope: "tile-engine",
		event: "motion.peer-snap.end",
		detail: {
			...meta,
			targetRect: target,
		},
	});
};
