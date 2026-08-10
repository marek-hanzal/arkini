import { Effect } from "effect";

import type { EditorItemOriginFlowLayoutInput } from "~/ui/item/editor/editorItemOriginFlowLayout";

export interface EditorItemOriginFlowLayoutProfile {
	readonly haloX: number;
	readonly haloY: number;
	readonly importance: number;
}

export interface EditorItemOriginFlowPair {
	readonly a: string;
	readonly b: string;
}

export interface EditorItemOriginFlowDirectedPair {
	readonly source: string;
	readonly target: string;
}

export interface EditorItemOriginFlowTopology {
	readonly directedPairs: ReadonlyArray<EditorItemOriginFlowDirectedPair>;
	readonly flowOrder: ReadonlyMap<string, number>;
	readonly pairs: ReadonlyArray<EditorItemOriginFlowPair>;
	readonly profiles: ReadonlyMap<string, EditorItemOriginFlowLayoutProfile>;
}

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

const addWeight = (map: Map<string, number>, id: string) => {
	map.set(id, (map.get(id) ?? 0) + 1);
};

const readWeightedGraph = (flow: EditorItemOriginFlowLayoutInput): WeightedGraph => {
	const incoming = new Map<string, Map<string, number>>();
	const outgoing = new Map<string, Map<string, number>>();
	for (const { id } of flow.nodes) {
		incoming.set(id, new Map());
		outgoing.set(id, new Map());
	}
	for (const { source, target } of flow.edges) {
		addWeight(outgoing.get(source)!, target);
		addWeight(incoming.get(target)!, source);
	}
	return {
		incoming,
		outgoing,
	};
};

const sumWeights = (entries: ReadonlyMap<string, number>) => {
	let total = 0;
	for (const weight of entries.values()) total += weight;
	return total;
};

const readFlowOrder = (
	flow: EditorItemOriginFlowLayoutInput,
	graph: WeightedGraph,
): ReadonlyMap<string, number> => {
	const nodeIds = flow.nodes.map(({ id }) => id).sort((left, right) => left.localeCompare(right));
	const active = new Set(nodeIds);
	const inDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeights(graph.incoming.get(id) ?? new Map()),
		]),
	);
	const outDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeights(graph.outgoing.get(id) ?? new Map()),
		]),
	);
	const left: string[] = [];
	const right: string[] = [];

	const remove = (id: string, side: "left" | "right") => {
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
				.sort((leftId, rightId) => leftId.localeCompare(rightId));
			for (const id of sinks) {
				if (!active.has(id)) continue;
				remove(id, "right");
				removedTerminal = true;
			}
			const sources = [
				...active,
			]
				.filter((id) => (inDegree.get(id) ?? 0) === 0)
				.sort((leftId, rightId) => leftId.localeCompare(rightId));
			for (const id of sources) {
				if (!active.has(id)) continue;
				remove(id, "left");
				removedTerminal = true;
			}
		}
		if (active.size === 0) break;

		let bestId: string | undefined;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (const id of active) {
			const score = (outDegree.get(id) ?? 0) - (inDegree.get(id) ?? 0);
			if (
				score > bestScore ||
				(score === bestScore && (bestId === undefined || id.localeCompare(bestId) < 0))
			) {
				bestId = id;
				bestScore = score;
			}
		}
		if (bestId === undefined) throw new Error("Could not order the flow graph.");
		remove(bestId, "left");
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

const readPairs = (flow: EditorItemOriginFlowLayoutInput) => {
	const pairs = new Map<string, EditorItemOriginFlowPair>();
	for (const edge of flow.edges) {
		if (edge.source === edge.target) continue;
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
		const key = `${a}\u0000${b}`;
		if (!pairs.has(key))
			pairs.set(key, {
				a,
				b,
			});
	}
	return [
		...pairs.values(),
	].sort((left, right) => left.a.localeCompare(right.a) || left.b.localeCompare(right.b));
};

const readDirectedPairs = (flow: EditorItemOriginFlowLayoutInput) => {
	const pairs = new Map<string, EditorItemOriginFlowDirectedPair>();
	for (const edge of flow.edges) {
		if (edge.source === edge.target) continue;
		const key = `${edge.source}\u0000${edge.target}`;
		if (!pairs.has(key))
			pairs.set(key, {
				source: edge.source,
				target: edge.target,
			});
	}
	return [
		...pairs.values(),
	].sort(
		(left, right) =>
			left.source.localeCompare(right.source) || left.target.localeCompare(right.target),
	);
};

const readProfiles = (
	flow: EditorItemOriginFlowLayoutInput,
	pairs: ReadonlyArray<EditorItemOriginFlowPair>,
) => {
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

/** Validates the flow and derives its stable pair, order, and pressure topology. */
export const readEditorItemOriginFlowTopologyFx = Effect.fn("readEditorItemOriginFlowTopologyFx")(
	(flow: EditorItemOriginFlowLayoutInput) =>
		Effect.sync(() => {
			const nodeById = new Map(
				flow.nodes.map(
					(node) =>
						[
							node.id,
							node,
						] as const,
				),
			);
			for (const edge of flow.edges)
				if (!nodeById.has(edge.source) || !nodeById.has(edge.target))
					throw new Error(
						`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
					);

			const pairs = readPairs(flow);
			return {
				directedPairs: readDirectedPairs(flow),
				flowOrder: readFlowOrder(flow, readWeightedGraph(flow)),
				pairs,
				profiles: readProfiles(flow, pairs),
			} satisfies EditorItemOriginFlowTopology;
		}),
);
