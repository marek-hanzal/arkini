import cytoscape, { type ElementDefinition } from "cytoscape";
import fcose from "cytoscape-fcose";
import { Effect } from "effect";

import type { LayoutInput } from "~/flow-layout/type/Layout";
import type { LayoutProfile, Pair, PlacedNode } from "~/flow-layout/type/LayoutTopology";
import type { Communities } from "~/flow-layout/fx/readCommunitiesFx";

cytoscape.use(fcose);

const RandomSeed = 0x4444bbbb;
const HorizontalScale = 2.2;
const VerticalScale = 0.95;
const RankShift = 280;

const seededRandom = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
};

/** Runs deterministic fCoSE placement from explicit rank, profile, and community facts. */
export const placeFx = Effect.fn("placeFx")(
	(
		flow: LayoutInput,
		pairs: ReadonlyArray<Pair>,
		profiles: ReadonlyMap<string, LayoutProfile>,
		ranks: ReadonlyMap<string, number>,
		{ communities, communityByNodeId }: Communities,
	) =>
		Effect.sync(() => {
			const types = [
				...new Set(flow.nodes.map(({ type }) => type)),
			].sort((left, right) => left.localeCompare(right));
			const elements: ElementDefinition[] = [];
			for (const communityId of communities.keys())
				elements.push({
					data: {
						anchor: true,
						id: `community:${communityId}`,
					},
				});
			for (const type of types)
				elements.push({
					data: {
						anchor: true,
						id: `type:${type}`,
					},
				});

			for (const node of [
				...flow.nodes,
			].sort((left, right) => left.id.localeCompare(right.id))) {
				const profile = profiles.get(node.id);
				if (profile === undefined)
					throw new Error(`Missing flow layout profile for ${node.id}.`);
				elements.push({
					data: {
						h: node.height + profile.haloY * 2,
						id: node.id,
						w: node.width + profile.haloX * 2,
					},
				});
				const communityId = communityByNodeId.get(node.id);
				if (communityId !== undefined)
					elements.push({
						data: {
							id: `community-edge:${node.id}`,
							importance: profile.importance,
							source: node.id,
							target: `community:${communityId}`,
							virtualKind: "community",
						},
					});
				elements.push({
					data: {
						id: `type-edge:${node.id}`,
						importance: profile.importance,
						source: node.id,
						target: `type:${node.type}`,
						virtualKind: "type",
					},
				});
			}
			for (const [index, pair] of pairs.entries()) {
				const source = profiles.get(pair.a);
				const target = profiles.get(pair.b);
				if (source === undefined || target === undefined)
					throw new Error(`Missing flow layout profile for ${pair.a} -> ${pair.b}.`);
				elements.push({
					data: {
						id: `pair:${index}`,
						pressure: Math.max(source.importance, target.importance),
						source: pair.a,
						target: pair.b,
						virtualKind: "pair",
					},
				});
			}

			const graph = cytoscape({
				elements,
				headless: true,
				style: [
					{
						selector: "node[!anchor]",
						style: {
							height: "data(h)",
							shape: "rectangle",
							width: "data(w)",
						},
					},
					{
						selector: "node[?anchor]",
						style: {
							height: 20,
							width: 20,
						},
					},
				],
				styleEnabled: true,
			});
			const previousRandom = Math.random;
			Math.random = seededRandom(RandomSeed);
			try {
				graph
					.layout({
						animate: false,
						edgeElasticity: (edge: cytoscape.EdgeSingular) => {
							const kind = edge.data("virtualKind") as string | undefined;
							const importance = Number(edge.data("importance") ?? 0);
							if (kind === "community") return 0.02 + 0.08 * (1 - importance);
							if (kind === "type") return 0.006 + 0.025 * (1 - importance);
							return 0.28 / (1 + Number(edge.data("pressure") ?? 0));
						},
						fit: false,
						gravity: 0.045,
						gravityRange: 5.5,
						idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
							const kind = edge.data("virtualKind") as string | undefined;
							if (kind === "community") return 480;
							if (kind === "type") return 760;
							return 130 + 250 * Number(edge.data("pressure") ?? 0) ** 1.2;
						},
						name: "fcose",
						nodeRepulsion: (node: cytoscape.NodeSingular) => {
							if (node.data("anchor") === true) return 18000;
							const profile = profiles.get(node.id());
							return profile === undefined
								? 7000
								: 7000 * (1 + 5 * profile.importance ** 1.4);
						},
						nodeSeparation: 140,
						numIter: 5000,
						packComponents: false,
						quality: "default",
						randomize: true,
						tile: true,
					} as cytoscape.LayoutOptions)
					.run();
			} finally {
				Math.random = previousRandom;
			}

			try {
				return [
					...flow.nodes,
				]
					.sort((left, right) => left.id.localeCompare(right.id))
					.map((node): PlacedNode => {
						const profile = profiles.get(node.id);
						if (profile === undefined)
							throw new Error(`Missing flow layout profile for ${node.id}.`);
						const rank = ranks.get(node.id) ?? 0;
						const position = graph.getElementById(node.id).position();
						return {
							haloX: profile.haloX,
							haloY: profile.haloY,
							height: node.height,
							id: node.id,
							importance: profile.importance,
							width: node.width,
							x: position.x * HorizontalScale - node.width / 2 + rank * RankShift,
							y: position.y * VerticalScale - node.height / 2,
						};
					});
			} finally {
				graph.destroy();
			}
		}),
);
