import { Order } from "effect";
import type {
	ItemOriginEdge,
	ItemOriginFlow,
	ItemOriginItemNode,
} from "~/flow/type/ItemOriginFlow";
import type { OriginFlowDirection, Highlight, Selection } from "~/flow-canvas/type/Highlight";

const EdgeOrderFn = Order.make<ItemOriginEdge>(
	(left, right) =>
		Order.String(left.operationId, right.operationId) || Order.String(left.id, right.id),
);

interface HighlightTrace {
	readonly edgeIds: Set<string>;
	readonly nodeIds: Set<string>;
}

const addHighlightEdgeFn = (trace: HighlightTrace, edge: ItemOriginEdge) => {
	trace.edgeIds.add(edge.id);
	trace.nodeIds.add(edge.source);
	trace.nodeIds.add(edge.target);
};

interface InputHighlightTrace extends HighlightTrace {
	readonly inputEdgesBySource: ReadonlyMap<string, ReadonlyArray<ItemOriginEdge>>;
	readonly nodeById: ReadonlyMap<string, ItemOriginItemNode>;
	readonly operationIdsByOwner: ReadonlyMap<string, ReadonlySet<string>>;
	readonly outputEdgesByOperation: ReadonlyMap<string, ReadonlyArray<ItemOriginEdge>>;
	readonly ownerNodeIdByOperation: ReadonlyMap<string, string>;
	readonly tracedItems: Set<string>;
	readonly tracedOperations: Set<string>;
}

const traceInputOperationFn = (trace: InputHighlightTrace, operationId: string) => {
	if (trace.tracedOperations.has(operationId)) return;
	trace.tracedOperations.add(operationId);
	const ownerNodeId = trace.ownerNodeIdByOperation.get(operationId);
	if (ownerNodeId !== undefined) trace.nodeIds.add(ownerNodeId);
	for (const edge of [
		...(trace.outputEdgesByOperation.get(operationId) ?? []),
	].sort(EdgeOrderFn)) {
		addHighlightEdgeFn(trace, edge);
		const outputNode = trace.nodeById.get(edge.target);
		if (outputNode !== undefined) traceInputItemFn(trace, outputNode);
	}
};

const traceInputItemFn = (trace: InputHighlightTrace, itemNode: ItemOriginItemNode) => {
	trace.nodeIds.add(itemNode.id);
	if (trace.tracedItems.has(itemNode.id)) return;
	trace.tracedItems.add(itemNode.id);

	const operationIds = new Set(trace.operationIdsByOwner.get(itemNode.id) ?? []);
	for (const edge of [
		...(trace.inputEdgesBySource.get(itemNode.id) ?? []),
	].sort(EdgeOrderFn)) {
		addHighlightEdgeFn(trace, edge);
		operationIds.add(edge.operationId);
	}
	for (const operationId of [
		...operationIds,
	].sort((left, right) => Order.String(left, right)))
		traceInputOperationFn(trace, operationId);
};

/** Reads every operation that depends on the selected item and recursively follows its outputs. */
const readInputHighlightFn = (flow: ItemOriginFlow, startNode: ItemOriginItemNode): Highlight => {
	const nodeById = new Map(
		flow.nodes.map(
			(node) =>
				[
					node.id,
					node,
				] as const,
		),
	);
	const inputEdgesBySource = new Map<string, ItemOriginEdge[]>();
	const outputEdgesByOperation = new Map<string, ItemOriginEdge[]>();
	const ownerNodeIdByOperation = new Map<string, string>();
	const operationIdsByOwner = new Map<string, Set<string>>();
	for (const edge of flow.edges) {
		const ownerNodeId = edge.role === "output" ? edge.source : edge.target;
		ownerNodeIdByOperation.set(edge.operationId, ownerNodeId);
		const ownerOperations = operationIdsByOwner.get(ownerNodeId) ?? new Set<string>();
		ownerOperations.add(edge.operationId);
		operationIdsByOwner.set(ownerNodeId, ownerOperations);
		if (edge.role === "input") {
			const edges = inputEdgesBySource.get(edge.source) ?? [];
			edges.push(edge);
			inputEdgesBySource.set(edge.source, edges);
		} else {
			const edges = outputEdgesByOperation.get(edge.operationId) ?? [];
			edges.push(edge);
			outputEdgesByOperation.set(edge.operationId, edges);
		}
	}

	const nodeIds = new Set<string>([
		startNode.id,
	]);
	const edgeIds = new Set<string>();
	traceInputItemFn(
		{
			edgeIds,
			inputEdgesBySource,
			nodeById,
			nodeIds,
			operationIdsByOwner,
			outputEdgesByOperation,
			ownerNodeIdByOperation,
			tracedItems: new Set(),
			tracedOperations: new Set(),
		},
		startNode,
	);
	return {
		edgeIds,
		edgeLevels: new Map(),
		nodeIds,
		nodeLevels: new Map(),
	};
};

interface OutputHighlightTrace extends HighlightTrace {
	readonly inputEdgesByOperation: ReadonlyMap<string, ReadonlyArray<ItemOriginEdge>>;
	readonly nodeById: ReadonlyMap<string, ItemOriginItemNode>;
	readonly outputEdgesByTarget: ReadonlyMap<string, ReadonlyArray<ItemOriginEdge>>;
	readonly ownerNodeIdByOperation: ReadonlyMap<string, string>;
	readonly tracedItems: Set<string>;
	readonly tracedOperations: Set<string>;
}

const traceOutputItemFn = (
	trace: OutputHighlightTrace,
	itemNode: ItemOriginItemNode,
	activeItemIds: ReadonlySet<string>,
) => {
	trace.nodeIds.add(itemNode.id);
	if (
		itemNode.starterScopes.length > 0 ||
		activeItemIds.has(itemNode.id) ||
		trace.tracedItems.has(itemNode.id)
	)
		return;
	trace.tracedItems.add(itemNode.id);

	const directOutputEdgesForItem = [
		...(trace.outputEdgesByTarget.get(itemNode.id) ?? []),
	].sort(EdgeOrderFn);
	const witness =
		itemNode.acquisitionSourceId === undefined
			? directOutputEdgesForItem[0]
			: directOutputEdgesForItem.find(
					({ operationId }) => operationId === itemNode.acquisitionSourceId,
				);
	if (witness === undefined) return;

	const nextActiveItemIds = new Set(activeItemIds);
	nextActiveItemIds.add(itemNode.id);
	for (const outputEdge of directOutputEdgesForItem) {
		if (outputEdge.operationId === witness.operationId) addHighlightEdgeFn(trace, outputEdge);
	}
	traceOutputOperationFn(trace, witness.operationId, nextActiveItemIds);
};

const traceOutputOperationFn = (
	trace: OutputHighlightTrace,
	operationId: string,
	activeItemIds: ReadonlySet<string>,
) => {
	if (trace.tracedOperations.has(operationId)) return;
	trace.tracedOperations.add(operationId);
	const ownerNodeId = trace.ownerNodeIdByOperation.get(operationId);
	const ownerNode = ownerNodeId === undefined ? undefined : trace.nodeById.get(ownerNodeId);
	if (ownerNode !== undefined) traceOutputItemFn(trace, ownerNode, activeItemIds);
	for (const edge of [
		...(trace.inputEdgesByOperation.get(operationId) ?? []),
	].sort(EdgeOrderFn)) {
		addHighlightEdgeFn(trace, edge);
		const requirementNode = trace.nodeById.get(edge.source);
		if (requirementNode !== undefined) traceOutputItemFn(trace, requirementNode, activeItemIds);
	}
};

/** Reads every direct producer branch and one deterministic acquisition proof below each branch. */
const readOutputHighlightFn = (flow: ItemOriginFlow, startNode: ItemOriginItemNode): Highlight => {
	const nodeById = new Map(
		flow.nodes.map(
			(node) =>
				[
					node.id,
					node,
				] as const,
		),
	);
	const outputEdgesByTarget = new Map<string, ItemOriginEdge[]>();
	const inputEdgesByOperation = new Map<string, ItemOriginEdge[]>();
	const ownerNodeIdByOperation = new Map<string, string>();
	for (const edge of flow.edges) {
		ownerNodeIdByOperation.set(
			edge.operationId,
			edge.role === "output" ? edge.source : edge.target,
		);
		if (edge.role === "output") {
			const edges = outputEdgesByTarget.get(edge.target) ?? [];
			edges.push(edge);
			outputEdgesByTarget.set(edge.target, edges);
		} else {
			const edges = inputEdgesByOperation.get(edge.operationId) ?? [];
			edges.push(edge);
			inputEdgesByOperation.set(edge.operationId, edges);
		}
	}

	const nodeIds = new Set<string>([
		startNode.id,
	]);
	const edgeIds = new Set<string>();
	if (startNode.starterScopes.length > 0)
		return {
			edgeIds,
			edgeLevels: new Map(),
			nodeIds,
			nodeLevels: new Map(),
		};

	const directEdgesByProducer = new Map<string, ItemOriginEdge[]>();
	for (const edge of [
		...(outputEdgesByTarget.get(startNode.id) ?? []),
	].sort(EdgeOrderFn)) {
		if (edge.source === startNode.id) continue;
		const edges = directEdgesByProducer.get(edge.source) ?? [];
		edges.push(edge);
		directEdgesByProducer.set(edge.source, edges);
	}
	const directBranches = [
		...directEdgesByProducer.entries(),
	].sort(([leftId], [rightId]) => {
		const left = nodeById.get(leftId);
		const right = nodeById.get(rightId);
		if (left === undefined || right === undefined) return Order.String(leftId, rightId);
		return (
			Order.String(left.title, right.title) ||
			Order.String(left.itemId, right.itemId) ||
			Order.String(leftId, rightId)
		);
	});

	for (const [, directOutputEdges] of directBranches) {
		const trace: OutputHighlightTrace = {
			edgeIds,
			inputEdgesByOperation,
			nodeById,
			nodeIds,
			outputEdgesByTarget,
			ownerNodeIdByOperation,
			tracedItems: new Set(),
			tracedOperations: new Set(),
		};

		const directOperationIds = [
			...new Set(directOutputEdges.map(({ operationId }) => operationId)),
		].sort((left, right) => Order.String(left, right));
		for (const edge of directOutputEdges) addHighlightEdgeFn(trace, edge);
		const rootActiveItemIds = new Set([
			startNode.id,
		]);
		for (const operationId of directOperationIds)
			traceOutputOperationFn(trace, operationId, rootActiveItemIds);
	}

	return {
		edgeIds,
		edgeLevels: new Map(),
		nodeIds,
		nodeLevels: new Map(),
	};
};

const connectHighlightNodesFn = (adjacency: Map<string, string[]>, left: string, right: string) => {
	const neighbors = adjacency.get(left) ?? [];
	neighbors.push(right);
	adjacency.set(left, neighbors);
};

/** Assigns breadth-first visual depth to every node and edge in one selected flow. */
const readHighlightLevelsFn = (
	flow: ItemOriginFlow,
	highlight: Highlight,
	rootNodeId: string,
): Highlight => {
	const edges = flow.edges.filter(({ id }) => highlight.edgeIds.has(id));
	const adjacency = new Map<string, string[]>();
	for (const edge of edges) {
		if (edge.source === edge.target) continue;
		connectHighlightNodesFn(adjacency, edge.source, edge.target);
		connectHighlightNodesFn(adjacency, edge.target, edge.source);
	}

	const nodeLevels = new Map<string, number>([
		[
			rootNodeId,
			0,
		],
	]);
	const queue = [
		rootNodeId,
	];
	for (let index = 0; index < queue.length; index += 1) {
		const nodeId = queue[index]!;
		const nextLevel = nodeLevels.get(nodeId)! + 1;
		for (const neighborId of adjacency.get(nodeId) ?? []) {
			if (!highlight.nodeIds.has(neighborId) || nodeLevels.has(neighborId)) continue;
			nodeLevels.set(neighborId, nextLevel);
			queue.push(neighborId);
		}
	}

	const edgeLevels = new Map<string, number>();
	for (const edge of edges) {
		const sourceLevel = nodeLevels.get(edge.source);
		const targetLevel = nodeLevels.get(edge.target);
		if (sourceLevel === undefined || targetLevel === undefined) continue;
		edgeLevels.set(edge.id, Math.max(sourceLevel, targetLevel));
	}

	return {
		...highlight,
		edgeLevels,
		nodeLevels,
	};
};

const readEmptyHighlightFn = (): Highlight => ({
	edgeIds: new Set(),
	edgeLevels: new Map(),
	nodeIds: new Set(),
	nodeLevels: new Map(),
});

/** Reads the complete directional graph selected by an item or connection. */
export const readHighlightFn = (
	flow: ItemOriginFlow,
	selection: Selection,
	direction: OriginFlowDirection = "input",
) => {
	const readNodeHighlightFn =
		direction === "output" ? readOutputHighlightFn : readInputHighlightFn;
	if (selection.kind === "node") {
		const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
		if (selectedNode === undefined) return readEmptyHighlightFn();
		const highlight = readNodeHighlightFn(flow, selectedNode);
		return readHighlightLevelsFn(flow, highlight, selectedNode.id);
	}

	const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
	if (selectedEdge === undefined) return readEmptyHighlightFn();
	const startNodeId = direction === "output" ? selectedEdge.source : selectedEdge.target;
	const startNode = flow.nodes.find(({ id }) => id === startNodeId);
	if (startNode === undefined)
		return {
			edgeIds: new Set([
				selectedEdge.id,
			]),
			edgeLevels: new Map(),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
			]),
			nodeLevels: new Map(),
		};
	const highlight = readNodeHighlightFn(flow, startNode);
	return readHighlightLevelsFn(
		flow,
		{
			edgeIds: new Set([
				selectedEdge.id,
				...highlight.edgeIds,
			]),
			edgeLevels: new Map(),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
				...highlight.nodeIds,
			]),
			nodeLevels: new Map(),
		},
		startNode.id,
	);
};
