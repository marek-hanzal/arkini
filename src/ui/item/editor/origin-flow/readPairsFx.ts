import { Effect } from "effect";

import type {
	DirectedPair,
	Pair,
} from "~/ui/item/editor/origin-flow/Topology";
import type { LayoutInput } from "~/ui/item/editor/origin-flow/Layout";

/** Deduplicates directed and undirected edge pairs for rank and placement phases. */
export const readPairsFx = Effect.fn("readPairsFx")(
	(flow: LayoutInput) =>
		Effect.sync(() => {
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
					edge.source.localeCompare(edge.target) <= 0
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
						left.source.localeCompare(right.source) ||
						left.target.localeCompare(right.target),
				),
				pairs: [
					...pairs.values(),
				].sort(
					(left, right) => left.a.localeCompare(right.a) || left.b.localeCompare(right.b),
				),
			};
		}),
);
