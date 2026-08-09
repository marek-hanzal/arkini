import { Effect } from "effect";

import type { EditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlightFx";

/** Restricts one node highlight to the visible graph-distance level. */
export const readEditorOriginFlowVisibleHighlightFx = Effect.fn(
	"readEditorOriginFlowVisibleHighlightFx",
)((highlight: EditorOriginFlowHighlight, maxLevel: number) =>
	Effect.sync((): EditorOriginFlowHighlight => {
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
