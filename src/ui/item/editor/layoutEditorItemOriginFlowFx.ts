import { Effect } from "effect";

import type {
	EditorItemOriginFlowLayoutInput,
	EditorItemOriginFlowLayoutNode,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import { normalizeEditorItemOriginFlowPositionsFx } from "~/ui/item/editor/normalizeEditorItemOriginFlowPositionsFx";
import { placeEditorItemOriginFlowFx } from "~/ui/item/editor/placeEditorItemOriginFlowFx";
import { readEditorItemOriginFlowCommunitiesFx } from "~/ui/item/editor/readEditorItemOriginFlowCommunitiesFx";
import { readEditorItemOriginFlowRanksFx } from "~/ui/item/editor/readEditorItemOriginFlowRanksFx";
import { readEditorItemOriginFlowTopologyFx } from "~/ui/item/editor/readEditorItemOriginFlowTopologyFx";
import { routeEditorItemOriginFlowFx } from "~/ui/item/editor/routeEditorItemOriginFlowFx";

/** Computes one deterministic rich-node flow map using topology first and semantics second. */
export const layoutEditorItemOriginFlowFx = Effect.fn("layoutEditorItemOriginFlowFx")(function* (
	flow: EditorItemOriginFlowLayoutInput,
) {
	if (flow.nodes.length === 0) {
		const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
		const backbones = yield* routeEditorItemOriginFlowFx(flow, positions);
		return {
			backbones,
			positions,
		};
	}
	const topology = yield* readEditorItemOriginFlowTopologyFx(flow);
	const ranks = yield* readEditorItemOriginFlowRanksFx(flow, topology.directedPairs);
	const communities = yield* readEditorItemOriginFlowCommunitiesFx(flow, topology.pairs);
	const placed = yield* placeEditorItemOriginFlowFx(
		flow,
		topology.pairs,
		topology.profiles,
		ranks,
		communities,
	);
	const positions = yield* normalizeEditorItemOriginFlowPositionsFx(
		placed,
		topology.profiles,
		topology.flowOrder,
	);
	const backbones = yield* routeEditorItemOriginFlowFx(flow, positions);
	return {
		backbones,
		positions,
	};
});
