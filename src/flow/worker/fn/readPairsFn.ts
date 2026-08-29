import { Order } from "effect";

import type { DirectedPair, Pair } from "~/flow/worker/Topology";
import type { LayoutInput } from "~/flow/worker/Layout";

/** Deduplicates directed and undirected edge pairs for rank and placement phases. */
export const readPairsFn = (flow: LayoutInput) => {
	const pairs = new Map<string, Pair>();
	const directedPairs = new Map<string, DirectedPair>();
	for (const edge of flow.edges) {
		if (edge.source === edge.target) continue;
		const directedKey = `${edge.source}\u0000${edge.target}`;
		if (!directedPairs.has(directedKey))
			directedPairs.set(directedKey, {
				source: edge.source,
				target: edge.target,
			});

		const [a, b] =
			Order.String(edge.source, edge.target) <= 0
				? [
						edge.source,
						edge.target,
					]
				: [
						edge.target,
						edge.source,
					];
		const pairKey = `${a}\u0000${b}`;
		if (!pairs.has(pairKey))
			pairs.set(pairKey, {
				a,
				b,
			});
	}
	return {
		directedPairs: [
			...directedPairs.values(),
		].sort(
			(left, right) =>
				Order.String(left.source, right.source) || Order.String(left.target, right.target),
		),
		pairs: [
			...pairs.values(),
		].sort((left, right) => Order.String(left.a, right.a) || Order.String(left.b, right.b)),
	};
};
