import { Effect } from "effect";

import type {
	LayoutInput,
	LayoutNode,
} from "~/ui/item/editor/origin-flow/Layout";
import { normalizePositionsFx } from "~/ui/item/editor/origin-flow/normalizePositionsFx";
import { placeFx } from "~/ui/item/editor/origin-flow/placeFx";
import { readCommunitiesFx } from "~/ui/item/editor/origin-flow/readCommunitiesFx";
import { readRanksFx } from "~/ui/item/editor/origin-flow/readRanksFx";
import { readTopologyFx } from "~/ui/item/editor/origin-flow/readTopologyFx";
import { routeFx } from "~/ui/item/editor/origin-flow/routeFx";

/** Computes one deterministic rich-node flow map using topology first and semantics second. */
export const layoutFx = Effect.fn("layoutFx")(function* (
	flow: LayoutInput,
) {
	if (flow.nodes.length === 0) {
		const positions = new Map<string, LayoutNode>();
		const backbones = yield* routeFx(flow, positions);
		return {
			backbones,
			positions,
		};
	}
	const topology = yield* readTopologyFx(flow);
	const ranks = yield* readRanksFx(flow, topology.directedPairs);
	const communities = yield* readCommunitiesFx(flow, topology.pairs);
	const placed = yield* placeFx(
		flow,
		topology.pairs,
		topology.profiles,
		ranks,
		communities,
	);
	const positions = yield* normalizePositionsFx(
		placed,
		topology.profiles,
		topology.flowOrder,
	);
	const backbones = yield* routeFx(flow, positions);
	return {
		backbones,
		positions,
	};
});
