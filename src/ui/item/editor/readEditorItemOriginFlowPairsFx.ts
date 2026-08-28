import { Effect } from "effect";

import type {
	EditorItemOriginFlowDirectedPair,
	EditorItemOriginFlowPair,
} from "~/ui/item/editor/EditorItemOriginFlowTopology";
import type { EditorItemOriginFlowLayoutInput } from "~/ui/item/editor/editorItemOriginFlowLayout";

/** Deduplicates directed and undirected edge pairs for rank and placement phases. */
export const readEditorItemOriginFlowPairsFx = Effect.fn("readEditorItemOriginFlowPairsFx")(
	(flow: EditorItemOriginFlowLayoutInput) =>
		Effect.sync(() => {
			const pairs = new Map<string, EditorItemOriginFlowPair>();
			const directedPairs = new Map<string, EditorItemOriginFlowDirectedPair>();
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
