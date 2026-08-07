export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly id: string;
		readonly source: string;
		readonly target: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly id: string;
		readonly kind: "item" | "source";
	}>;
}

export interface EditorItemOriginFlowLayoutNode {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayoutPoint {
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayout {
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
}

const NodeWidth = 420;
const NodeHeight = 176;
const RowGap = 24;
const ColumnGap = 96;
const Padding = 20;
const MaxRowsPerColumn = 48;
const EdgePortPadding = 22;
const TargetAspectRatio = 16 / 9;

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

type NodeSide = "left" | "right";

interface EdgeSides {
	readonly source: NodeSide;
	readonly target: NodeSide;
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

/**
 * Produces a deterministic near-acyclic ordering using the Eades-style source/sink heuristic.
 * Feedback edges remain renderable, but the vast majority of edges point to a later order.
 */
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

const readColumn = (flowOrder: number, rowsPerColumn: number) =>
	Math.floor(flowOrder / rowsPerColumn);

const readRowsPerColumn = (
	flow: EditorItemOriginFlowLayoutInput,
	flowOrder: ReadonlyMap<string, number>,
) => {
	const nodeCount = flow.nodes.length;
	if (nodeCount <= 1) return 1;
	const upperBound = Math.min(MaxRowsPerColumn, nodeCount);
	let bestRows = 1;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let rows = 1; rows <= upperBound; rows += 1) {
		const columns = Math.ceil(nodeCount / rows);
		const width = Padding * 2 + columns * NodeWidth + Math.max(0, columns - 1) * ColumnGap;
		const height = Padding * 2 + rows * NodeHeight + Math.max(0, rows - 1) * RowGap;
		const aspectError = Math.abs(Math.log(width / height / TargetAspectRatio));
		let sameColumnEdges = 0;
		for (const edge of flow.edges) {
			const sourceOrder = flowOrder.get(edge.source);
			const targetOrder = flowOrder.get(edge.target);
			if (sourceOrder === undefined || targetOrder === undefined) continue;
			if (readColumn(sourceOrder, rows) === readColumn(targetOrder, rows))
				sameColumnEdges += 1;
		}
		const sameColumnRatio = sameColumnEdges / Math.max(1, flow.edges.length);
		const occupiedArea = Math.max(1, nodeCount * NodeWidth * NodeHeight);
		const areaInflation = (width * height) / occupiedArea;
		const score =
			aspectError + sameColumnRatio * 0.14 + Math.max(0, Math.log(areaInflation)) * 0.02;
		if (score < bestScore) {
			bestRows = rows;
			bestScore = score;
		}
	}
	return bestRows;
};

const readColumnNodes = (
	flow: EditorItemOriginFlowLayoutInput,
	flowOrder: ReadonlyMap<string, number>,
	rowsPerColumn: number,
) => {
	const columnCount = Math.ceil(flow.nodes.length / rowsPerColumn);
	const columns = Array.from(
		{
			length: columnCount,
		},
		() => [] as string[],
	);
	for (const { id } of [
		...flow.nodes,
	].sort((left, right) => {
		const leftOrder = flowOrder.get(left.id);
		const rightOrder = flowOrder.get(right.id);
		if (leftOrder === undefined || rightOrder === undefined)
			throw new Error("Missing flow order while grouping nodes.");
		return leftOrder - rightOrder || left.id.localeCompare(right.id);
	})) {
		const order = flowOrder.get(id)!;
		columns[readColumn(order, rowsPerColumn)]!.push(id);
	}

	const incoming = new Map<string, string[]>();
	const outgoing = new Map<string, string[]>();
	for (const { id } of flow.nodes) {
		incoming.set(id, []);
		outgoing.set(id, []);
	}
	for (const edge of flow.edges) {
		incoming.get(edge.target)?.push(edge.source);
		outgoing.get(edge.source)?.push(edge.target);
	}

	const readRows = () => {
		const rows = new Map<string, number>();
		for (const column of columns) for (const [row, id] of column.entries()) rows.set(id, row);
		return rows;
	};
	const sortColumn = (
		columnIndex: number,
		neighbors: ReadonlyMap<string, ReadonlyArray<string>>,
		acceptNeighbor: (neighborColumn: number) => boolean,
	) => {
		const rows = readRows();
		const column = columns[columnIndex]!;
		const barycenter = (id: string) => {
			let total = 0;
			let count = 0;
			for (const neighbor of neighbors.get(id) ?? []) {
				const neighborOrder = flowOrder.get(neighbor);
				const neighborRow = rows.get(neighbor);
				if (neighborOrder === undefined || neighborRow === undefined) continue;
				if (!acceptNeighbor(readColumn(neighborOrder, rowsPerColumn))) continue;
				total += neighborRow;
				count += 1;
			}
			return count === 0 ? undefined : total / count;
		};
		column.sort((left, right) => {
			const leftCenter = barycenter(left);
			const rightCenter = barycenter(right);
			if (leftCenter !== undefined && rightCenter !== undefined && leftCenter !== rightCenter)
				return leftCenter - rightCenter;
			if (leftCenter !== undefined && rightCenter === undefined) return -1;
			if (leftCenter === undefined && rightCenter !== undefined) return 1;
			return (
				(flowOrder.get(left) ?? 0) - (flowOrder.get(right) ?? 0) ||
				left.localeCompare(right)
			);
		});
	};

	for (let sweep = 0; sweep < 4; sweep += 1) {
		for (let column = 1; column < columns.length; column += 1)
			sortColumn(column, incoming, (neighborColumn) => neighborColumn < column);
		for (let column = columns.length - 2; column >= 0; column -= 1)
			sortColumn(column, outgoing, (neighborColumn) => neighborColumn > column);
	}
	return columns;
};

const readPositions = (
	flow: EditorItemOriginFlowLayoutInput,
	flowOrder: ReadonlyMap<string, number>,
	rowsPerColumn: number,
): ReadonlyMap<string, EditorItemOriginFlowLayoutNode> => {
	const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
	const columns = readColumnNodes(flow, flowOrder, rowsPerColumn);
	for (const [column, nodeIds] of columns.entries()) {
		for (const [row, id] of nodeIds.entries()) {
			const order = flowOrder.get(id);
			if (order === undefined) throw new Error(`Missing flow order for ${id}.`);
			positions.set(id, {
				flowOrder: order,
				height: NodeHeight,
				width: NodeWidth,
				x: Padding + column * (NodeWidth + ColumnGap),
				y: Padding + row * (NodeHeight + RowGap),
			});
		}
	}
	return positions;
};

const oppositeSide = (side: NodeSide): NodeSide => (side === "left" ? "right" : "left");

const readEdgeSides = (
	source: EditorItemOriginFlowLayoutNode,
	target: EditorItemOriginFlowLayoutNode,
	rowsPerColumn: number,
): EdgeSides => {
	const sourceColumn = readColumn(source.flowOrder, rowsPerColumn);
	const targetColumn = readColumn(target.flowOrder, rowsPerColumn);
	if (targetColumn > sourceColumn)
		return {
			source: "right",
			target: "left",
		};
	if (targetColumn < sourceColumn)
		return {
			source: "left",
			target: "right",
		};
	const forwardSide: NodeSide = sourceColumn % 2 === 0 ? "right" : "left";
	const side = target.flowOrder > source.flowOrder ? forwardSide : oppositeSide(forwardSide);
	return {
		source: side,
		target: side,
	};
};

const readEdgePortYs = (
	flow: EditorItemOriginFlowLayoutInput,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	rowsPerColumn: number,
) => {
	const byEndpoint = new Map<
		string,
		Array<{
			edgeId: string;
			otherY: number;
		}>
	>();
	const edgeSides = new Map<string, EdgeSides>();
	const addEndpoint = (nodeId: string, side: NodeSide, edgeId: string, otherY: number) => {
		const key = `${nodeId}:${side}`;
		const endpoints = byEndpoint.get(key) ?? [];
		endpoints.push({
			edgeId,
			otherY,
		});
		byEndpoint.set(key, endpoints);
	};

	for (const edge of flow.edges) {
		const source = positions.get(edge.source);
		const target = positions.get(edge.target);
		if (source === undefined || target === undefined)
			throw new Error(`Missing position for edge ${edge.id}.`);
		const sides = readEdgeSides(source, target, rowsPerColumn);
		edgeSides.set(edge.id, sides);
		addEndpoint(edge.source, sides.source, edge.id, target.y + target.height / 2);
		addEndpoint(edge.target, sides.target, edge.id, source.y + source.height / 2);
	}

	const portY = new Map<string, number>();
	for (const [endpoint, edges] of byEndpoint) {
		const split = endpoint.lastIndexOf(":");
		const nodeId = endpoint.slice(0, split);
		const side = endpoint.slice(split + 1) as NodeSide;
		const position = positions.get(nodeId);
		if (position === undefined) throw new Error(`Missing endpoint position for ${nodeId}.`);
		edges.sort(
			(left, right) => left.otherY - right.otherY || left.edgeId.localeCompare(right.edgeId),
		);
		const usableHeight = Math.max(1, position.height - EdgePortPadding * 2);
		for (const [index, { edgeId }] of edges.entries()) {
			const y =
				position.y + EdgePortPadding + ((index + 1) / (edges.length + 1)) * usableHeight;
			portY.set(`${edgeId}:${nodeId}:${side}`, y);
		}
	}
	return {
		edgeSides,
		portY,
	};
};

const readSideX = (position: EditorItemOriginFlowLayoutNode, side: NodeSide) =>
	side === "left" ? position.x : position.x + position.width;

const readHashUnit = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0xffffffff;
};

const readRoute = (
	edgeId: string,
	source: EditorItemOriginFlowLayoutNode,
	target: EditorItemOriginFlowLayoutNode,
	sides: EdgeSides,
	sourceY: number,
	targetY: number,
): ReadonlyArray<EditorItemOriginFlowLayoutPoint> => {
	const start = {
		x: readSideX(source, sides.source),
		y: sourceY,
	};
	const end = {
		x: readSideX(target, sides.target),
		y: targetY,
	};
	const sameColumn = source.x === target.x;
	if (sameColumn) {
		const direction = sides.source === "right" ? 1 : -1;
		const span = Math.abs(end.y - start.y);
		const lane = 48 + Math.min(92, span * 0.18) + readHashUnit(edgeId) * 18;
		const controlX = start.x + direction * lane;
		return [
			start,
			{
				x: controlX,
				y: start.y,
			},
			{
				x: controlX,
				y: end.y,
			},
			end,
		];
	}

	const deltaX = end.x - start.x;
	const direction = Math.sign(deltaX) || 1;
	const controlDistance = Math.max(58, Math.min(260, Math.abs(deltaX) * 0.38));
	const bias = (readHashUnit(edgeId) - 0.5) * 22;
	return [
		start,
		{
			x: start.x + direction * controlDistance,
			y: start.y + bias,
		},
		{
			x: end.x - direction * controlDistance,
			y: end.y - bias,
		},
		end,
	];
};

/** Computes a compact deterministic flow layout without routing every edge through shared buses. */
export const layoutEditorItemOriginFlow = (
	flow: EditorItemOriginFlowLayoutInput,
): EditorItemOriginFlowLayout => {
	if (flow.nodes.length === 0)
		return {
			positions: new Map(),
			routes: new Map(),
		};
	const graph = readWeightedGraph(flow);
	const flowOrder = readFlowOrder(flow, graph);
	const rowsPerColumn = readRowsPerColumn(flow, flowOrder);
	const positions = readPositions(flow, flowOrder, rowsPerColumn);
	const { edgeSides, portY } = readEdgePortYs(flow, positions, rowsPerColumn);
	const routes = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	for (const edge of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const source = positions.get(edge.source);
		const target = positions.get(edge.target);
		const sides = edgeSides.get(edge.id);
		if (source === undefined || target === undefined || sides === undefined)
			throw new Error(`Could not route edge ${edge.id}.`);
		const sourceY = portY.get(`${edge.id}:${edge.source}:${sides.source}`);
		const targetY = portY.get(`${edge.id}:${edge.target}:${sides.target}`);
		if (sourceY === undefined || targetY === undefined)
			throw new Error(`Could not place edge ports for ${edge.id}.`);
		routes.set(edge.id, readRoute(edge.id, source, target, sides, sourceY, targetY));
	}
	return {
		positions,
		routes,
	};
};
