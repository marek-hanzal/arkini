import { Effect } from "effect";

import type { Highlight } from "~/ui/item/editor/origin-flow/Highlight";

/** Restricts one node highlight to the visible graph-distance level. */
export const readVisibleHighlightFx = Effect.fn(
	"readVisibleHighlightFx",
)((highlight: Highlight, maxLevel: number) =>
	Effect.sync((): Highlight => {
		const boundedLevel = Math.max(0, Math.floor(maxLevel));
		const nodeLevels = new Map(
			[
				...highlight.nodeLevels,
			].filter(([, level]) => level <= boundedLevel),
		);
		const edgeLevels = new Map(
			[
				...highlight.edgeLevels,
			].filter(([, level]) => level <= boundedLevel),
		);
		return {
			edgeIds: new Set(edgeLevels.keys()),
			edgeLevels,
			nodeIds: new Set(nodeLevels.keys()),
			nodeLevels,
		};
	}),
);
