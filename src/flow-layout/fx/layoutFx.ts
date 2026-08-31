import { Effect, Order } from "effect";

import { readRanksFn } from "~/flow-layout/fn/readRanksFn";
import type { LayoutInput, LayoutNode } from "~/flow-layout/type/Layout";
import type { DirectedPair, LayoutProfile, Pair } from "~/flow-layout/type/LayoutTopology";
import { normalizePositionsFx } from "~/flow-layout/fx/normalizePositionsFx";
import { placeFx } from "~/flow-layout/fx/placeFx";
import { readCommunitiesFx } from "~/flow-layout/fx/readCommunitiesFx";
import { routeFx } from "~/flow-layout/fx/routeFx";

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

const addWeightFn = (map: Map<string, number>, id: string) => {
	map.set(id, (map.get(id) ?? 0) + 1);
};

const readWeightedGraphFn = (flow: LayoutInput): WeightedGraph => {
	const incoming = new Map<string, Map<string, number>>();
	const outgoing = new Map<string, Map<string, number>>();
	for (const { id } of flow.nodes) {
		incoming.set(id, new Map());
		outgoing.set(id, new Map());
	}
	for (const { source, target } of flow.edges) {
		addWeightFn(outgoing.get(source)!, target);
		addWeightFn(incoming.get(target)!, source);
	}
	return {
		incoming,
		outgoing,
	};
};

const sumWeightsFn = (entries: ReadonlyMap<string, number>) => {
	let total = 0;
	for (const weight of entries.values()) total += weight;
	return total;
};

/** Keeps feedback edges explicit while giving highlight traversal one stable forward order. */
const readOrderFn = (flow: LayoutInput): ReadonlyMap<string, number> => {
	const graph = readWeightedGraphFn(flow);
	const nodeIds = flow.nodes.map(({ id }) => id).sort((left, right) => Order.String(left, right));
	const active = new Set(nodeIds);
	const inDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeightsFn(graph.incoming.get(id) ?? new Map()),
		]),
	);
	const outDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeightsFn(graph.outgoing.get(id) ?? new Map()),
		]),
	);
	const left: string[] = [];
	const right: string[] = [];

	const removeFn = (id: string, side: "left" | "right") => {
		active.delete(id);
		(side === "left" ? left : right).push(id);
		for (const [target, weight] of graph.outgoing.get(id) ?? []) {
			if (active.has(target)) inDegree.set(target, (inDegree.get(target) ?? 0) - weight);
		}
		for (const [source, weight] of graph.incoming.get(id) ?? []) {
			if (active.has(source)) outDegree.set(source, (outDegree.get(source) ?? 0) - weight);
		}
	};

	while (active.size > 0) {
		let removedTerminal = true;
		while (removedTerminal && active.size > 0) {
			removedTerminal = false;
			const sinks = [
				...active,
			]
				.filter((id) => (outDegree.get(id) ?? 0) === 0)
				.sort((leftId, rightId) => Order.String(leftId, rightId));
			for (const id of sinks) {
				if (!active.has(id)) continue;
				removeFn(id, "right");
				removedTerminal = true;
			}
			const sources = [
				...active,
			]
				.filter((id) => (inDegree.get(id) ?? 0) === 0)
				.sort((leftId, rightId) => Order.String(leftId, rightId));
			for (const id of sources) {
				if (!active.has(id)) continue;
				removeFn(id, "left");
				removedTerminal = true;
			}
		}
		if (active.size === 0) break;

		const firstActiveId = active.values().next().value;
		if (firstActiveId === undefined) break;
		let bestId = firstActiveId;
		let bestScore = (outDegree.get(bestId) ?? 0) - (inDegree.get(bestId) ?? 0);
		for (const id of active) {
			const score = (outDegree.get(id) ?? 0) - (inDegree.get(id) ?? 0);
			if (score > bestScore || (score === bestScore && Order.String(id, bestId) < 0)) {
				bestId = id;
				bestScore = score;
			}
		}
		removeFn(bestId, "left");
	}

	const ordered = [
		...left,
		...right.reverse(),
	];
	return new Map(
		ordered.map((id, index) => [
			id,
			index,
		]),
	);
};

/** Deduplicates directed and undirected edge pairs for rank and placement phases. */
const readPairsFn = (flow: LayoutInput) => {
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

/** Derives node spacing pressure from topology degree and connected operation ports. */
const readProfilesFn = (
	flow: LayoutInput,
	pairs: ReadonlyArray<Pair>,
): ReadonlyMap<string, LayoutProfile> => {
	const neighbors = new Map(
		flow.nodes.map(
			({ id }) =>
				[
					id,
					new Set<string>(),
				] as const,
		),
	);
	const connectedPorts = new Map(
		flow.nodes.map(
			({ id }) =>
				[
					id,
					new Set<string>(),
				] as const,
		),
	);
	for (const { a, b } of pairs) {
		neighbors.get(a)?.add(b);
		neighbors.get(b)?.add(a);
	}
	for (const edge of flow.edges) {
		connectedPorts.get(edge.source)?.add(`source:${edge.sourcePortId ?? "item"}`);
		connectedPorts.get(edge.target)?.add(`target:${edge.targetPortId ?? "item"}`);
	}
	const maximumDegree = Math.max(
		1,
		...[
			...neighbors.values(),
		].map((value) => value.size),
	);
	const maximumPortCount = Math.max(
		1,
		...[
			...connectedPorts.values(),
		].map((value) => value.size),
	);
	return new Map(
		flow.nodes.map((node) => {
			const degree = neighbors.get(node.id)?.size ?? 0;
			const portCount = connectedPorts.get(node.id)?.size ?? 0;
			const degreePressure = Math.sqrt(degree / maximumDegree);
			const portPressure = Math.sqrt(portCount / maximumPortCount);
			const importance = Math.min(1, 0.75 * degreePressure + 0.25 * portPressure);
			return [
				node.id,
				{
					haloX: 30 + 150 * importance ** 1.2 + 28 * Math.log2(1 + degree),
					haloY: 24 + 90 * importance ** 1.2 + 12 * Math.log2(1 + portCount),
					importance,
				},
			] as const;
		}),
	);
};

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
