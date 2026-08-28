import { Effect } from "effect";

import type { EditorItemOriginFlowTopology } from "~/ui/item/editor/EditorItemOriginFlowTopology";
import type { EditorItemOriginFlowLayoutInput } from "~/ui/item/editor/editorItemOriginFlowLayout";
import { readEditorItemOriginFlowOrderFx } from "~/ui/item/editor/readEditorItemOriginFlowOrderFx";
import { readEditorItemOriginFlowPairsFx } from "~/ui/item/editor/readEditorItemOriginFlowPairsFx";
import { readEditorItemOriginFlowProfilesFx } from "~/ui/item/editor/readEditorItemOriginFlowProfilesFx";

export type {
	EditorItemOriginFlowDirectedPair,
	EditorItemOriginFlowLayoutProfile,
	EditorItemOriginFlowPair,
	EditorItemOriginFlowTopology,
} from "~/ui/item/editor/EditorItemOriginFlowTopology";

/** Validates the flow and derives its stable pair, order, and pressure topology. */
export const readEditorItemOriginFlowTopologyFx = Effect.fn("readEditorItemOriginFlowTopologyFx")(
	function* (flow: EditorItemOriginFlowLayoutInput) {
		const nodeIds = new Set(flow.nodes.map(({ id }) => id));
		for (const edge of flow.edges)
			if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
				throw new Error(
					`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
				);

		const { directedPairs, pairs } = yield* readEditorItemOriginFlowPairsFx(flow);
		const flowOrder = yield* readEditorItemOriginFlowOrderFx(flow);
		const profiles = yield* readEditorItemOriginFlowProfilesFx(flow, pairs);
		return {
			directedPairs,
			flowOrder,
			pairs,
			profiles,
		} satisfies EditorItemOriginFlowTopology;
	},
);
