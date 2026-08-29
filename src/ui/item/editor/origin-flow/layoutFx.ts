import { Effect } from "effect";

import { normalizePositionsFn } from "~/ui/item/editor/origin-flow/fn/normalizePositionsFn";
import { readCommunitiesFn } from "~/ui/item/editor/origin-flow/fn/readCommunitiesFn";
import { readRanksFn } from "~/ui/item/editor/origin-flow/fn/readRanksFn";
import { readTopologyFn } from "~/ui/item/editor/origin-flow/fn/readTopologyFn";
import { routeFn } from "~/ui/item/editor/origin-flow/fn/routeFn";
import type { LayoutInput, LayoutNode } from "~/ui/item/editor/origin-flow/Layout";
import { placeFx } from "~/ui/item/editor/origin-flow/placeFx";

/** Computes one deterministic rich-node flow map using topology first and semantics second. */
export const layoutFx = Effect.fn("layoutFx")(function* (flow: LayoutInput) {
	if (flow.nodes.length === 0) {
		const positions = new Map<string, LayoutNode>();
		const backbones = routeFn(flow, positions);
		return {
			backbones,
			positions,
		};
	}
	const topology = readTopologyFn(flow);
	const ranks = readRanksFn(flow, topology.directedPairs);
	const communities = readCommunitiesFn(flow, topology.pairs);
	const placed = yield* placeFx(flow, topology.pairs, topology.profiles, ranks, communities);
	const positions = normalizePositionsFn(placed, topology.profiles, topology.flowOrder);
	const backbones = routeFn(flow, positions);
	return {
		backbones,
		positions,
	};
});
