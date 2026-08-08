import cytoscape, { type CollectionReturnValue, type ElementDefinition } from "cytoscape";
import fcose from "cytoscape-fcose";
import { Effect } from "effect";

import type { EditorItemOriginItemNode } from "~/bridge/item/editor/readEditorItemOriginFlow";

cytoscape.use(fcose);

export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly id: string;
		readonly source: string;
		readonly sourcePortId?: string;
		readonly target: string;
		readonly targetPortId?: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly id: string;
		readonly type: EditorItemOriginItemNode["type"];
	}>;
}

export interface EditorItemOriginFlowLayoutNode {
	readonly degree: number;
	readonly flowOrder: number;
	readonly height: number;
	readonly importance: number;
	readonly portCount: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayoutPoint {
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayout {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
}

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

interface LayoutProfile {
	readonly degree: number;
	readonly diameter: number;
	readonly importance: number;
	readonly portCount: number;
}

interface PairEdge {
	readonly a: string;
	readonly b: string;
	readonly multiplicity: number;
}

interface MutableNodePosition {
	readonly diameter: number;
	readonly id: string;
	readonly importance: number;
	x: number;
	y: number;
}

const LayoutMargin = 96;
const OverlapGap = 28;
const OverlapIterations = 900;
const OverlapTolerance = 0.15;
const MinimumNodeDiameter = 135;
const ImportanceDiameter = 300;
const PortPressureDiameter = 90;
const CommunityMinimumSize = 3;
const RandomSeed = 0xc011a95e;

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
		const sourceOutgoing = outgoing.get(source);
		const targetIncoming = incoming.get(target);
		if (sourceOutgoing === undefined || targetIncoming === undefined)
			throw new Error(`Flow edge references an unknown node: ${source} -> ${target}.`);
		addWeight(sourceOutgoing, target);
		addWeight(targetIncoming, source);
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

/** Keeps feedback edges explicit while giving highlight traversal one stable forward order. */
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
			if (!active.has(target)) continue;
			inDegree.set(target, (inDegree.get(target) ?? 0) - weight);
		}
		for (const [source, weight] of graph.incoming.get(id) ?? []) {
			if (!active.has(source)) continue;
			outDegree.set(source, (outDegree.get(source) ?? 0) - weight);
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

const readPairEdges = (flow: EditorItemOriginFlowLayoutInput): ReadonlyArray<PairEdge> => {
	const pairs = new Map<string, PairEdge>();
	for (const edge of flow.edges) {
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
		const existing = pairs.get(key);
		pairs.set(key, {
			a,
			b,
			multiplicity: (existing?.multiplicity ?? 0) + 1,
		});
	}
	return [
		...pairs.values(),
	].sort((left, right) => left.a.localeCompare(right.a) || left.b.localeCompare(right.b));
};

const readProfiles = (
	flow: EditorItemOriginFlowLayoutInput,
	pairs: ReadonlyArray<PairEdge>,
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
			const importance = Math.min(1, 0.82 * degreePressure + 0.18 * portPressure);
			const typeDiameter = node.type === "producer" ? 25 : node.type === "blueprint" ? 12 : 0;
			const diameter = Math.round(
				MinimumNodeDiameter +
					ImportanceDiameter * importance ** 1.15 +
					PortPressureDiameter * portPressure +
					typeDiameter,
			);
			return [
				node.id,
				{
					degree,
					diameter,
					importance,
					portCount,
				},
			] as const;
		}),
	);
};

interface MclCollection extends CollectionReturnValue {
	mcl(options: {
		readonly inflateFactor: number;
		readonly maxIterations: number;
	}): ReadonlyArray<CollectionReturnValue>;
}

const readCommunities = (flow: EditorItemOriginFlowLayoutInput, pairs: ReadonlyArray<PairEdge>) => {
	const raw = cytoscape({
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
		const clusters = (raw.elements() as MclCollection).mcl({
			inflateFactor: 2,
			maxIterations: 20,
		});
		const canonicalClusters = clusters
			.map((cluster) =>
				cluster
					.nodes()
					.map((node) => node.id())
					.sort((left, right) => left.localeCompare(right)),
			)
			.filter((ids) => ids.length >= CommunityMinimumSize)
			.sort((left, right) => (left[0] ?? "").localeCompare(right[0] ?? ""));
		const communityByNodeId = new Map<string, number>();
		const validCommunityIds = new Set<number>();
		for (const [index, ids] of canonicalClusters.entries()) {
			validCommunityIds.add(index);
			for (const id of ids) communityByNodeId.set(id, index);
		}
		return {
			communityByNodeId,
			validCommunityIds,
		};
	} finally {
		raw.destroy();
	}
};

const seededRandom = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
};

const deterministicUnit = (leftId: string, rightId: string) => {
	let hash = 2166136261;
	for (const char of `${leftId}\u0000${rightId}`) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
	return {
		x: Math.cos(angle),
		y: Math.sin(angle),
	};
};

const relaxOverlaps = (nodes: MutableNodePosition[]) => {
	for (let iteration = 0; iteration < OverlapIterations; iteration += 1) {
		let maximumOverlap = 0;
		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			const left = nodes[leftIndex]!;
			for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
				const right = nodes[rightIndex]!;
				let dx = right.x - left.x;
				let dy = right.y - left.y;
				let actualDistance = Math.hypot(dx, dy);
				if (actualDistance < 0.001) {
					const unit = deterministicUnit(left.id, right.id);
					dx = unit.x;
					dy = unit.y;
					actualDistance = 1;
				}
				const desiredDistance = (left.diameter + right.diameter) / 2 + OverlapGap;
				const overlap = desiredDistance - actualDistance;
				if (overlap <= 0) continue;
				maximumOverlap = Math.max(maximumOverlap, overlap);
				const unitX = dx / actualDistance;
				const unitY = dy / actualDistance;
				const leftInverseMass = 1 / (1 + 18 * left.importance ** 2);
				const rightInverseMass = 1 / (1 + 18 * right.importance ** 2);
				const inverseMass = leftInverseMass + rightInverseMass;
				const leftMove = overlap * (leftInverseMass / inverseMass);
				const rightMove = overlap * (rightInverseMass / inverseMass);
				left.x -= unitX * leftMove;
				left.y -= unitY * leftMove;
				right.x += unitX * rightMove;
				right.y += unitY * rightMove;
			}
		}
		if (maximumOverlap < OverlapTolerance) break;
	}
};

const runFcose = (
	flow: EditorItemOriginFlowLayoutInput,
	pairs: ReadonlyArray<PairEdge>,
	profiles: ReadonlyMap<string, LayoutProfile>,
) => {
	const { communityByNodeId, validCommunityIds } = readCommunities(flow, pairs);
	const types = [
		...new Set(flow.nodes.map(({ type }) => type)),
	].sort((left, right) => left.localeCompare(right));
	const elements: ElementDefinition[] = [];
	for (const communityId of [
		...validCommunityIds,
	].sort((left, right) => left - right))
		elements.push({
			data: {
				anchorKind: "community",
				id: `community:${communityId}`,
				isAnchor: true,
			},
		});
	for (const type of types)
		elements.push({
			data: {
				anchorKind: "type",
				id: `type:${type}`,
				isAnchor: true,
			},
		});

	for (const node of [
		...flow.nodes,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const profile = profiles.get(node.id);
		if (profile === undefined) throw new Error(`Missing flow layout profile for ${node.id}.`);
		elements.push({
			data: {
				degree: profile.degree,
				diameter: profile.diameter,
				id: node.id,
				importance: profile.importance,
				isAnchor: false,
				portCount: profile.portCount,
				type: node.type,
			},
		});
		const communityId = communityByNodeId.get(node.id);
		if (communityId !== undefined && validCommunityIds.has(communityId))
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
		const sourceProfile = profiles.get(pair.a);
		const targetProfile = profiles.get(pair.b);
		if (sourceProfile === undefined || targetProfile === undefined)
			throw new Error(`Missing flow layout profile for ${pair.a} -> ${pair.b}.`);
		elements.push({
			data: {
				id: `pair:${index}`,
				multiplicity: pair.multiplicity,
				pressure: Math.max(sourceProfile.importance, targetProfile.importance),
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
				selector: "node[!isAnchor]",
				style: {
					height: "data(diameter)",
					shape: "ellipse",
					width: "data(diameter)",
				},
			},
			{
				selector: "node[?isAnchor]",
				style: {
					height: 20,
					shape: "ellipse",
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
					if (kind === "community") return 0.02 + 0.11 * (1 - importance) ** 1.6;
					if (kind === "type") return 0.008 + 0.035 * (1 - importance) ** 1.5;
					const pressure = Number(edge.data("pressure") ?? 0);
					const multiplicity = Math.sqrt(Number(edge.data("multiplicity") ?? 1));
					return Math.min(
						0.62,
						(0.34 / (1 + 0.7 * pressure)) * Math.min(1.8, multiplicity),
					);
				},
				fit: false,
				gravity: 0.06,
				gravityRange: 5.2,
				idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
					const kind = edge.data("virtualKind") as string | undefined;
					if (kind === "community") return 500;
					if (kind === "type") return 850;
					return 95 + 200 * Number(edge.data("pressure") ?? 0) ** 1.25;
				},
				name: "fcose",
				nodeRepulsion: (node: cytoscape.NodeSingular) => {
					if (node.data("isAnchor") === true)
						return node.data("anchorKind") === "community" ? 19000 : 23000;
					const profile = profiles.get(node.id());
					return profile === undefined
						? 4800
						: 4800 * (1 + 7 * profile.importance ** 1.5);
				},
				nodeSeparation: 130,
				numIter: 4500,
				packComponents: false,
				quality: "default",
				randomize: true,
				tile: true,
				tilingPaddingHorizontal: 35,
				tilingPaddingVertical: 35,
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
			.map((node): MutableNodePosition => {
				const profile = profiles.get(node.id);
				if (profile === undefined)
					throw new Error(`Missing flow layout profile for ${node.id}.`);
				const position = graph.getElementById(node.id).position();
				return {
					diameter: profile.diameter,
					id: node.id,
					importance: profile.importance,
					x: position.x,
					y: position.y,
				};
			});
	} finally {
		graph.destroy();
	}
};

const readBackbone = (
	source: EditorItemOriginFlowLayoutNode,
	target: EditorItemOriginFlowLayoutNode,
): ReadonlyArray<EditorItemOriginFlowLayoutPoint> => {
	const sourceCenter = {
		x: source.x + source.width / 2,
		y: source.y + source.height / 2,
	};
	const targetCenter = {
		x: target.x + target.width / 2,
		y: target.y + target.height / 2,
	};
	const dx = targetCenter.x - sourceCenter.x;
	const dy = targetCenter.y - sourceCenter.y;
	const length = Math.max(0.001, Math.hypot(dx, dy));
	const unitX = dx / length;
	const unitY = dy / length;
	return [
		{
			x: sourceCenter.x + unitX * (source.width / 2),
			y: sourceCenter.y + unitY * (source.height / 2),
		},
		{
			x: targetCenter.x - unitX * (target.width / 2),
			y: targetCenter.y - unitY * (target.height / 2),
		},
	];
};

const runLayout = (flow: EditorItemOriginFlowLayoutInput): EditorItemOriginFlowLayout => {
	if (flow.nodes.length === 0)
		return {
			backbones: new Map(),
			positions: new Map(),
		};
	const nodeIds = new Set(flow.nodes.map(({ id }) => id));
	for (const edge of flow.edges)
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
			throw new Error(
				`Flow edge references an unknown node: ${edge.source} -> ${edge.target}.`,
			);

	const weightedGraph = readWeightedGraph(flow);
	const flowOrder = readFlowOrder(flow, weightedGraph);
	const pairs = readPairEdges(flow);
	const profiles = readProfiles(flow, pairs);
	const relaxed = runFcose(flow, pairs, profiles);
	relaxOverlaps(relaxed);

	let minimumX = Number.POSITIVE_INFINITY;
	let minimumY = Number.POSITIVE_INFINITY;
	for (const node of relaxed) {
		minimumX = Math.min(minimumX, node.x - node.diameter / 2);
		minimumY = Math.min(minimumY, node.y - node.diameter / 2);
	}
	const shiftX = LayoutMargin - minimumX;
	const shiftY = LayoutMargin - minimumY;
	const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
	for (const node of relaxed) {
		const profile = profiles.get(node.id);
		const order = flowOrder.get(node.id);
		if (profile === undefined || order === undefined)
			throw new Error(`Missing final flow layout data for ${node.id}.`);
		positions.set(node.id, {
			degree: profile.degree,
			flowOrder: order,
			height: node.diameter,
			importance: profile.importance,
			portCount: profile.portCount,
			width: node.diameter,
			x: node.x - node.diameter / 2 + shiftX,
			y: node.y - node.diameter / 2 + shiftY,
		});
	}

	const backbones = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	for (const edge of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const source = positions.get(edge.source);
		const target = positions.get(edge.target);
		if (source === undefined || target === undefined)
			throw new Error(`Missing flow layout for ${edge.source} -> ${edge.target}.`);
		backbones.set(edge.id, readBackbone(source, target));
	}
	return {
		backbones,
		positions,
	};
};

/** Computes one deterministic weighted map layout using topology first and semantics second. */
export const layoutEditorItemOriginFlowFx = Effect.fn("layoutEditorItemOriginFlowFx")(
	(flow: EditorItemOriginFlowLayoutInput) => Effect.sync(() => runLayout(flow)),
);
