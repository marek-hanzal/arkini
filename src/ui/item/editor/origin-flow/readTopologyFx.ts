import { Effect } from "effect";

import type { Topology } from "~/ui/item/editor/origin-flow/Topology";
import type { LayoutInput } from "~/ui/item/editor/origin-flow/Layout";
import { readOrderFx } from "~/ui/item/editor/origin-flow/readOrderFx";
import { readPairsFx } from "~/ui/item/editor/origin-flow/readPairsFx";
import { readProfilesFx } from "~/ui/item/editor/origin-flow/readProfilesFx";

/** Validates the flow and derives its stable pair, order, and pressure topology. */
export const readTopologyFx = Effect.fn("readTopologyFx")(function* (flow: LayoutInput) {
	const nodeIds = new Set(flow.nodes.map(({ id }) => id));
	for (const edge of flow.edges)
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
			throw new Error(
				`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
			);

	const { directedPairs, pairs } = yield* readPairsFx(flow);
	const flowOrder = yield* readOrderFx(flow);
	const profiles = yield* readProfilesFx(flow, pairs);
	return {
		directedPairs,
		flowOrder,
		pairs,
		profiles,
	} satisfies Topology;
});
