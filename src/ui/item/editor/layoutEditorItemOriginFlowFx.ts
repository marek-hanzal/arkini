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
		readonly height: number;
		readonly id: string;
		readonly ports: ReadonlyArray<{
			readonly id: string;
			readonly x: number;
			readonly y: number;
		}>;
		readonly type: EditorItemOriginItemNode["type"];
		readonly width: number;
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
	/** Orthogonal port-to-port routes with explicit terminal escape segments. */
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
}

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

interface LayoutProfile {
	readonly degree: number;
	readonly haloX: number;
	readonly haloY: number;
	readonly importance: number;
	readonly portCount: number;
}

interface PairEdge {
	readonly a: string;
	readonly b: string;
	readonly multiplicity: number;
}

interface DirectedPairEdge {
	readonly source: string;
	readonly target: string;
}

interface MutableNodePosition {
	readonly haloX: number;
	readonly haloY: number;
	readonly height: number;
	readonly id: string;
	readonly importance: number;
	readonly width: number;
	x: number;
	y: number;
}

const LayoutMargin = 96;
const RandomSeed = 0x4444bbbb;
const HorizontalScale = 2.2;
const VerticalScale = 0.95;
const RankShift = 280;
const OverlapGap = 32;
const OverlapIterations = 1800;
const OverlapTolerance = 0.2;
const CommunityMinimumSize = 3;

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

const readDirectedPairs = (
	flow: EditorItemOriginFlowLayoutInput,
): ReadonlyArray<DirectedPairEdge> => {
	const pairs = new Map<string, DirectedPairEdge>();
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
			const importance = Math.min(1, 0.75 * degreePressure + 0.25 * portPressure);
			return [
				node.id,
				{
					degree,
					haloX: 30 + 150 * importance ** 1.2 + 28 * Math.log2(1 + degree),
					haloY: 24 + 90 * importance ** 1.2 + 12 * Math.log2(1 + portCount),
					importance,
					portCount,
				},
			] as const;
		}),
	);
};

const readStrongComponentRanks = (
	flow: EditorItemOriginFlowLayoutInput,
	directedPairs: ReadonlyArray<DirectedPairEdge>,
): ReadonlyMap<string, number> => {
	const nodeIds = flow.nodes.map(({ id }) => id).sort((left, right) => left.localeCompare(right));
	const outgoing = new Map(
		nodeIds.map(
			(id) =>
				[
					id,
					[] as string[],
				] as const,
		),
	);
	for (const pair of directedPairs) outgoing.get(pair.source)?.push(pair.target);
	for (const targets of outgoing.values())
		targets.sort((left, right) => left.localeCompare(right));

	let nextIndex = 0;
	const stack: string[] = [];
	const onStack = new Set<string>();
	const indexById = new Map<string, number>();
	const lowById = new Map<string, number>();
	const componentById = new Map<string, number>();
	const components: string[][] = [];

	const visit = (id: string) => {
		indexById.set(id, nextIndex);
		lowById.set(id, nextIndex);
		nextIndex += 1;
		stack.push(id);
		onStack.add(id);
		for (const target of outgoing.get(id) ?? []) {
			if (!indexById.has(target)) {
				visit(target);
				lowById.set(id, Math.min(lowById.get(id)!, lowById.get(target)!));
			} else if (onStack.has(target)) {
				lowById.set(id, Math.min(lowById.get(id)!, indexById.get(target)!));
			}
		}
		if (lowById.get(id) !== indexById.get(id)) return;
		const members: string[] = [];
		while (stack.length > 0) {
			const member = stack.pop()!;
			onStack.delete(member);
			members.push(member);
			componentById.set(member, components.length);
			if (member === id) break;
		}
		members.sort((left, right) => left.localeCompare(right));
		components.push(members);
	};
	for (const id of nodeIds) if (!indexById.has(id)) visit(id);

	const dag = new Map(
		components.map(
			(_, index) =>
				[
					index,
					new Set<number>(),
				] as const,
		),
	);
	const inDegree = new Map<number, number>(
		components.map(
			(_, index) =>
				[
					index,
					0,
				] as const,
		),
	);
	for (const pair of directedPairs) {
		const source = componentById.get(pair.source)!;
		const target = componentById.get(pair.target)!;
		if (source === target || dag.get(source)!.has(target)) continue;
		dag.get(source)!.add(target);
		inDegree.set(target, inDegree.get(target)! + 1);
	}
	const queue = [
		...inDegree,
	]
		.filter(([, value]) => value === 0)
		.map(([component]) => component)
		.sort((left, right) => left - right);
	const rankByComponent = new Map<number, number>(
		components.map(
			(_, index) =>
				[
					index,
					0,
				] as const,
		),
	);
	while (queue.length > 0) {
		const component = queue.shift()!;
		for (const target of [
			...dag.get(component)!,
		].sort((left, right) => left - right)) {
			rankByComponent.set(
				target,
				Math.max(rankByComponent.get(target)!, rankByComponent.get(component)! + 1),
			);
			inDegree.set(target, inDegree.get(target)! - 1);
			if (inDegree.get(target) === 0) {
				queue.push(target);
				queue.sort((left, right) => left - right);
			}
		}
	}
	return new Map(
		nodeIds.map(
			(id) =>
				[
					id,
					rankByComponent.get(componentById.get(id)!) ?? 0,
				] as const,
		),
	);
};

interface MclCollection extends CollectionReturnValue {
	mcl(options: {
		readonly inflateFactor: number;
		readonly maxIterations: number;
	}): ReadonlyArray<CollectionReturnValue>;
}

const readCommunities = (flow: EditorItemOriginFlowLayoutInput, pairs: ReadonlyArray<PairEdge>) => {
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
		const canonical = clusters
			.map((cluster) =>
				cluster
					.nodes()
					.map((node) => node.id())
					.sort((left, right) => left.localeCompare(right)),
			)
			.filter((ids) => ids.length >= CommunityMinimumSize)
			.sort((left, right) => (left[0] ?? "").localeCompare(right[0] ?? ""));
		const communityByNodeId = new Map<string, number>();
		for (const [communityId, ids] of canonical.entries())
			for (const id of ids) communityByNodeId.set(id, communityId);
		return {
			communities: canonical,
			communityByNodeId,
		};
	} finally {
		graph.destroy();
	}
};

const seededRandom = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
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
				const leftX = left.x - left.haloX;
				const leftY = left.y - left.haloY;
				const leftWidth = left.width + left.haloX * 2;
				const leftHeight = left.height + left.haloY * 2;
				const rightX = right.x - right.haloX;
				const rightY = right.y - right.haloY;
				const rightWidth = right.width + right.haloX * 2;
				const rightHeight = right.height + right.haloY * 2;
				const overlapX =
					Math.min(leftX + leftWidth, rightX + rightWidth) - Math.max(leftX, rightX);
				const overlapY =
					Math.min(leftY + leftHeight, rightY + rightHeight) - Math.max(leftY, rightY);
				if (overlapX <= 0 || overlapY <= 0) continue;
				maximumOverlap = Math.max(maximumOverlap, Math.min(overlapX, overlapY));
				const leftInverseMass = 1 / (1 + 18 * left.importance ** 2);
				const rightInverseMass = 1 / (1 + 18 * right.importance ** 2);
				const inverseMass = leftInverseMass + rightInverseMass;
				if (overlapX < overlapY) {
					let direction = Math.sign(
						right.x + right.width / 2 - (left.x + left.width / 2),
					);
					if (direction === 0)
						direction = deterministicUnit(left.id, right.id).x >= 0 ? 1 : -1;
					const movement = overlapX + OverlapGap;
					left.x -= direction * movement * (leftInverseMass / inverseMass);
					right.x += direction * movement * (rightInverseMass / inverseMass);
				} else {
					let direction = Math.sign(
						right.y + right.height / 2 - (left.y + left.height / 2),
					);
					if (direction === 0)
						direction = deterministicUnit(left.id, right.id).y >= 0 ? 1 : -1;
					const movement = overlapY + OverlapGap;
					left.y -= direction * movement * (leftInverseMass / inverseMass);
					right.y += direction * movement * (rightInverseMass / inverseMass);
				}
			}
		}
		if (maximumOverlap < OverlapTolerance) break;
	}
};

const runFcose = (
	flow: EditorItemOriginFlowLayoutInput,
	pairs: ReadonlyArray<PairEdge>,
	profiles: ReadonlyMap<string, LayoutProfile>,
	ranks: ReadonlyMap<string, number>,
) => {
	const { communities, communityByNodeId } = readCommunities(flow, pairs);
	const types = [
		...new Set(flow.nodes.map(({ type }) => type)),
	].sort((left, right) => left.localeCompare(right));
	const elements: ElementDefinition[] = [];
	for (const communityId of communities.keys())
		elements.push({
			data: {
				anchor: true,
				anchorKind: "community",
				id: `community:${communityId}`,
			},
		});
	for (const type of types)
		elements.push({
			data: {
				anchor: true,
				anchorKind: "type",
				id: `type:${type}`,
			},
		});

	for (const node of [
		...flow.nodes,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const profile = profiles.get(node.id);
		if (profile === undefined) throw new Error(`Missing flow layout profile for ${node.id}.`);
		elements.push({
			data: {
				h: node.height + profile.haloY * 2,
				id: node.id,
				importance: profile.importance,
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
				multiplicity: pair.multiplicity,
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
			.map((node): MutableNodePosition => {
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
};

const readPortPoint = (
	node: EditorItemOriginFlowLayoutInput["nodes"][number],
	position: EditorItemOriginFlowLayoutNode,
	portId: string | undefined,
	side: "source" | "target",
): EditorItemOriginFlowLayoutPoint => {
	const port = portId === undefined ? undefined : node.ports.find(({ id }) => id === portId);
	if (port !== undefined)
		return {
			x: position.x + position.width / 2 + port.x,
			y: position.y + position.height / 2 + port.y,
		};
	return {
		x: side === "source" ? position.x + position.width : position.x,
		y: position.y + position.height / 2,
	};
};

const RouteEscape = 56;
const RouteDetourGap = 84;

const appendRoutePoint = (
	points: EditorItemOriginFlowLayoutPoint[],
	point: EditorItemOriginFlowLayoutPoint,
) => {
	const previous = points.at(-1);
	if (
		previous === undefined ||
		Math.abs(previous.x - point.x) > 0.01 ||
		Math.abs(previous.y - point.y) > 0.01
	)
		points.push(point);
};

const readOrthogonalRoute = (
	source: EditorItemOriginFlowLayoutPoint,
	target: EditorItemOriginFlowLayoutPoint,
	sourcePosition: EditorItemOriginFlowLayoutNode,
	targetPosition: EditorItemOriginFlowLayoutNode,
	edgeId: string,
): ReadonlyArray<EditorItemOriginFlowLayoutPoint> => {
	const sourceEscape = {
		x: source.x + RouteEscape,
		y: source.y,
	};
	const targetEscape = {
		x: target.x - RouteEscape,
		y: target.y,
	};
	const points: EditorItemOriginFlowLayoutPoint[] = [
		source,
	];
	appendRoutePoint(points, sourceEscape);

	if (sourceEscape.x <= targetEscape.x) {
		const jitter = deterministicUnit(edgeId, "ortho").y * 28;
		const minimumY = Math.min(source.y, target.y);
		const maximumY = Math.max(source.y, target.y);
		const middleY = Math.max(minimumY, Math.min(maximumY, (source.y + target.y) / 2 + jitter));
		appendRoutePoint(points, {
			x: sourceEscape.x,
			y: middleY,
		});
		appendRoutePoint(points, {
			x: targetEscape.x,
			y: middleY,
		});
	} else {
		const upperY =
			Math.min(sourcePosition.y, targetPosition.y) -
			RouteDetourGap -
			Math.abs(deterministicUnit(edgeId, "upper").y) * 32;
		const lowerY =
			Math.max(
				sourcePosition.y + sourcePosition.height,
				targetPosition.y + targetPosition.height,
			) +
			RouteDetourGap +
			Math.abs(deterministicUnit(edgeId, "lower").y) * 32;
		const upperCost = Math.abs(source.y - upperY) + Math.abs(target.y - upperY);
		const lowerCost = Math.abs(source.y - lowerY) + Math.abs(target.y - lowerY);
		const routeY = upperCost <= lowerCost ? upperY : lowerY;
		appendRoutePoint(points, {
			x: sourceEscape.x,
			y: routeY,
		});
		appendRoutePoint(points, {
			x: targetEscape.x,
			y: routeY,
		});
	}

	appendRoutePoint(points, targetEscape);
	appendRoutePoint(points, target);
	return points;
};

const runLayout = (flow: EditorItemOriginFlowLayoutInput): EditorItemOriginFlowLayout => {
	if (flow.nodes.length === 0)
		return {
			backbones: new Map(),
			positions: new Map(),
		};
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

	const weightedGraph = readWeightedGraph(flow);
	const flowOrder = readFlowOrder(flow, weightedGraph);
	const pairs = readPairEdges(flow);
	const profiles = readProfiles(flow, pairs);
	const ranks = readStrongComponentRanks(flow, readDirectedPairs(flow));
	const relaxed = runFcose(flow, pairs, profiles, ranks);
	relaxOverlaps(relaxed);

	let minimumX = Number.POSITIVE_INFINITY;
	let minimumY = Number.POSITIVE_INFINITY;
	for (const node of relaxed) {
		minimumX = Math.min(minimumX, node.x);
		minimumY = Math.min(minimumY, node.y);
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
			height: node.height,
			importance: profile.importance,
			portCount: profile.portCount,
			width: node.width,
			x: node.x + shiftX,
			y: node.y + shiftY,
		});
	}

	const backbones = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	for (const edge of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const sourceNode = nodeById.get(edge.source)!;
		const targetNode = nodeById.get(edge.target)!;
		const sourcePosition = positions.get(edge.source)!;
		const targetPosition = positions.get(edge.target)!;
		const source = readPortPoint(sourceNode, sourcePosition, edge.sourcePortId, "source");
		const target = readPortPoint(targetNode, targetPosition, edge.targetPortId, "target");
		backbones.set(
			edge.id,
			readOrthogonalRoute(source, target, sourcePosition, targetPosition, edge.id),
		);
	}
	return {
		backbones,
		positions,
	};
};

/** Computes one deterministic rich-node flow map using topology first and semantics second. */
export const layoutEditorItemOriginFlowFx = Effect.fn("layoutEditorItemOriginFlowFx")(
	(flow: EditorItemOriginFlowLayoutInput) => Effect.sync(() => runLayout(flow)),
);
