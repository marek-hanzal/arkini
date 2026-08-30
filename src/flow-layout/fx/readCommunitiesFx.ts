import cytoscape, { type CollectionReturnValue } from "cytoscape";
import { Effect, Order } from "effect";

import type { LayoutInput } from "~/flow-layout/type/Layout";
import type { Pair } from "~/flow-layout/type/LayoutTopology";

const CommunityMinimumSize = 3;

interface MclCollection extends CollectionReturnValue {
	mcl(options: {
		readonly inflateFactor: number;
		readonly maxIterations: number;
	}): ReadonlyArray<CollectionReturnValue>;
}

export interface Communities {
	readonly communities: ReadonlyArray<ReadonlyArray<string>>;
	readonly communityByNodeId: ReadonlyMap<string, number>;
}

/** Detects stable topology communities used only as placement anchors. */
export const readCommunitiesFx = Effect.fn("readCommunitiesFx")(
	(flow: LayoutInput, pairs: ReadonlyArray<Pair>) =>
		Effect.sync((): Communities => {
			const graph = cytoscape({
				elements: [
					...flow.nodes.map(({ id }) => ({
						data: {
							id,
						},
					})),
					...pairs.map((pair, index) => ({
						data: {
							id: `community-pair:${index}`,
							source: pair.a,
							target: pair.b,
						},
					})),
				],
				headless: true,
			});
			try {
				const clusters = (graph.elements() as MclCollection).mcl({
					inflateFactor: 2,
					maxIterations: 20,
				});
				const communities = clusters
					.map((cluster) =>
						cluster
							.nodes()
							.map((node) => node.id())
							.sort(Order.String),
					)
					.filter((ids) => ids.length >= CommunityMinimumSize)
					.sort((left, right) => Order.String(left[0] ?? "", right[0] ?? ""));
				const communityByNodeId = new Map<string, number>();
				for (const [communityId, ids] of communities.entries())
					for (const id of ids) communityByNodeId.set(id, communityId);
				return {
					communities,
					communityByNodeId,
				};
			} finally {
				graph.destroy();
			}
		}),
);
