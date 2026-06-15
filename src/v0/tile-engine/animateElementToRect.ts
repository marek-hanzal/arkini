import { animate } from "motion";
import { rectFromElement } from "~/v0/tile-engine/rect";
import { targetDelta } from "~/v0/tile-engine/targetDelta";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const animateElementToRect = async ({
	element,
	target,
}: {
	element: HTMLElement;
	target: TileEngine.Rect;
}) => {
	const delta = targetDelta({
		origin: rectFromElement(element),
		target,
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
};
