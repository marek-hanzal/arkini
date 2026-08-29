import { Effect } from "effect";

import type { Topology } from "~/ui/item/editor/origin-flow/Topology";
import type { LayoutInput } from "~/ui/item/editor/origin-flow/Layout";
import { readOrderFn } from "~/ui/item/editor/origin-flow/fn/readOrderFn";
import { readPairsFn } from "~/ui/item/editor/origin-flow/fn/readPairsFn";
import { readProfilesFn } from "~/ui/item/editor/origin-flow/fn/readProfilesFn";

/** Validates the flow and derives its stable pair, order, and pressure topology. */
export const readTopologyFx = Effect.fn("readTopologyFx")((flow: LayoutInput) =>
	Effect.sync((): Topology => {
		const nodeIds = new Set(flow.nodes.map(({ id }) => id));
		for (const edge of flow.edges)
			if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
				throw new Error(
					`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
				);

		const { directedPairs, pairs } = readPairsFn(flow);
		const flowOrder = readOrderFn(flow);
		const profiles = readProfilesFn(flow, pairs);
		return {
			directedPairs,
			flowOrder,
			pairs,
			profiles,
		};
	}),
);
