import { Effect } from "effect";

import { readOrderFn } from "~/flow/worker/fn/readOrderFn";
import { readPairsFn } from "~/flow/worker/fn/readPairsFn";
import { readProfilesFn } from "~/flow/worker/fn/readProfilesFn";
import { readRanksFn } from "~/flow/worker/fn/readRanksFn";
import type { LayoutInput, LayoutNode } from "~/flow/worker/Layout";
import { normalizePositionsFx } from "~/flow/worker/normalizePositionsFx";
import { placeFx } from "~/flow/worker/placeFx";
import { readCommunitiesFx } from "~/flow/worker/readCommunitiesFx";
import { routeFx } from "~/flow/worker/routeFx";

/** Computes one deterministic rich-node flow map using topology first and semantics second. */
export const layoutFx = Effect.fn("layoutFx")(function* (flow: LayoutInput) {
	if (flow.nodes.length === 0) {
		const positions = new Map<string, LayoutNode>();
		const backbones = yield* routeFx(flow, positions);
		return {
			backbones,
			positions,
		};
	}
	const nodeIds = new Set(flow.nodes.map(({ id }) => id));
	for (const edge of flow.edges)
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
			throw new Error(
				`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
			);
	const { directedPairs, pairs } = readPairsFn(flow);
	const flowOrder = readOrderFn(flow);
	const profiles = readProfilesFn(flow, pairs);
	const ranks = readRanksFn(flow, directedPairs);
	const communities = yield* readCommunitiesFx(flow, pairs);
	const placed = yield* placeFx(flow, pairs, profiles, ranks, communities);
	const positions = yield* normalizePositionsFx(placed, profiles, flowOrder);
	const backbones = yield* routeFx(flow, positions);
	return {
		backbones,
		positions,
	};
});
