import { Effect } from "effect";

import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/readEditorItemOriginFlowFx";

export type EditorOriginFlowDirection = "income" | "outcome";

export type EditorOriginFlowSelection =
	| {
			readonly id: string;
			readonly kind: "edge";
	  }
	| {
			readonly id: string;
			readonly kind: "node";
	  };

export interface EditorOriginFlowHighlight {
	readonly edgeIds: ReadonlySet<string>;
	readonly edgeLevels: ReadonlyMap<string, number>;
	readonly nodeIds: ReadonlySet<string>;
	readonly nodeLevels: ReadonlyMap<string, number>;
}

const readEmptyHighlight = (): EditorOriginFlowHighlight => ({
	edgeIds: new Set(),
	edgeLevels: new Map(),
	nodeIds: new Set(),
	nodeLevels: new Map(),
});

const sortEdges = (edges: ReadonlyArray<EditorItemOriginEdge>) =>
	[
		...edges,
	].sort(
		(left, right) =>
			left.operationId.localeCompare(right.operationId) || left.id.localeCompare(right.id),
	);

/** Reads every direct producer branch and one deterministic acquisition proof below each branch. */
const readIncomeHighlight = (
	flow: EditorItemOriginFlow,
	startNode: EditorItemOriginItemNode,
): EditorOriginFlowHighlight => {
	const nodeById = new Map(
		flow.nodes.map(
			(node) =>
				[
					node.id,
					node,
				] as const,
		),
	);
	const outputEdgesByTarget = new Map<string, EditorItemOriginEdge[]>();
	const inputEdgesByOperation = new Map<string, EditorItemOriginEdge[]>();
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

	const directEdgesByProducer = new Map<string, EditorItemOriginEdge[]>();
	for (const edge of sortEdges(outputEdgesByTarget.get(startNode.id) ?? [])) {
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
		if (left === undefined || right === undefined) return leftId.localeCompare(rightId);
		return (
			left.title.localeCompare(right.title) ||
			left.itemId.localeCompare(right.itemId) ||
			leftId.localeCompare(rightId)
		);
	});

	const markEdge = (edge: EditorItemOriginEdge) => {
		edgeIds.add(edge.id);
		nodeIds.add(edge.source);
		nodeIds.add(edge.target);
	};

	for (const [, directOutputEdges] of directBranches) {
		const tracedItems = new Set<string>();
		const tracedOperations = new Set<string>();
		const traceItem = (
			itemNode: EditorItemOriginItemNode,
			activeItemIds: ReadonlySet<string>,
		) => {
			nodeIds.add(itemNode.id);
			if (
				itemNode.starterScopes.length > 0 ||
				activeItemIds.has(itemNode.id) ||
				tracedItems.has(itemNode.id)
			)
				return;
			tracedItems.add(itemNode.id);

			const directOutputEdgesForItem = sortEdges(outputEdgesByTarget.get(itemNode.id) ?? []);
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
				if (outputEdge.operationId === witness.operationId) markEdge(outputEdge);
			}
			traceOperation(witness.operationId, nextActiveItemIds);
		};
		const traceOperation = (operationId: string, activeItemIds: ReadonlySet<string>) => {
			if (tracedOperations.has(operationId)) return;
			tracedOperations.add(operationId);
			const ownerNodeId = ownerNodeIdByOperation.get(operationId);
			const ownerNode = ownerNodeId === undefined ? undefined : nodeById.get(ownerNodeId);
			if (ownerNode !== undefined) traceItem(ownerNode, activeItemIds);
			for (const edge of sortEdges(inputEdgesByOperation.get(operationId) ?? [])) {
				markEdge(edge);
				const requirementNode = nodeById.get(edge.source);
				if (requirementNode !== undefined) traceItem(requirementNode, activeItemIds);
			}
		};

		const directOperationIds = [
			...new Set(directOutputEdges.map(({ operationId }) => operationId)),
		].sort((left, right) => left.localeCompare(right));
		for (const edge of directOutputEdges) markEdge(edge);
		const rootActiveItemIds = new Set([
			startNode.id,
		]);
		for (const operationId of directOperationIds)
			traceOperation(operationId, rootActiveItemIds);
	}

	return {
		edgeIds,
		edgeLevels: new Map(),
		nodeIds,
		nodeLevels: new Map(),
	};
};

/** Reads every operation that depends on the selected item and recursively follows its outputs. */
const readOutcomeHighlight = (
	flow: EditorItemOriginFlow,
	startNode: EditorItemOriginItemNode,
): EditorOriginFlowHighlight => {
	const nodeById = new Map(
		flow.nodes.map(
			(node) =>
				[
					node.id,
					node,
				] as const,
		),
	);
	const inputEdgesBySource = new Map<string, EditorItemOriginEdge[]>();
	const outputEdgesByOperation = new Map<string, EditorItemOriginEdge[]>();
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
	const tracedItems = new Set<string>();
	const tracedOperations = new Set<string>();
	const markEdge = (edge: EditorItemOriginEdge) => {
		edgeIds.add(edge.id);
		nodeIds.add(edge.source);
		nodeIds.add(edge.target);
	};

	const traceOperation = (operationId: string) => {
		if (tracedOperations.has(operationId)) return;
		tracedOperations.add(operationId);
		const ownerNodeId = ownerNodeIdByOperation.get(operationId);
		if (ownerNodeId !== undefined) nodeIds.add(ownerNodeId);
		for (const edge of sortEdges(outputEdgesByOperation.get(operationId) ?? [])) {
			markEdge(edge);
			const outputNode = nodeById.get(edge.target);
			if (outputNode !== undefined) traceItem(outputNode);
		}
	};
	const traceItem = (itemNode: EditorItemOriginItemNode) => {
		nodeIds.add(itemNode.id);
		if (tracedItems.has(itemNode.id)) return;
		tracedItems.add(itemNode.id);

		const operationIds = new Set(operationIdsByOwner.get(itemNode.id) ?? []);
		for (const edge of sortEdges(inputEdgesBySource.get(itemNode.id) ?? [])) {
			markEdge(edge);
			operationIds.add(edge.operationId);
		}
		for (const operationId of [
			...operationIds,
		].sort((left, right) => left.localeCompare(right)))
			traceOperation(operationId);
	};

	traceItem(startNode);
	return {
		edgeIds,
		edgeLevels: new Map(),
		nodeIds,
		nodeLevels: new Map(),
	};
};

const readHighlightLevels = (
	flow: EditorItemOriginFlow,
	highlight: EditorOriginFlowHighlight,
	rootNodeId: string,
): EditorOriginFlowHighlight => {
	const edges = flow.edges.filter(({ id }) => highlight.edgeIds.has(id));
	const adjacency = new Map<string, string[]>();
	const connect = (left: string, right: string) => {
		const neighbors = adjacency.get(left) ?? [];
		neighbors.push(right);
		adjacency.set(left, neighbors);
	};
	for (const edge of edges) {
		if (edge.source === edge.target) continue;
		connect(edge.source, edge.target);
		connect(edge.target, edge.source);
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

/** Reads the complete directional graph selected by an item or connection. */
export const readEditorOriginFlowHighlightFx = Effect.fn("readEditorOriginFlowHighlightFx")(
	(
		flow: EditorItemOriginFlow,
		selection: EditorOriginFlowSelection,
		direction: EditorOriginFlowDirection = "income",
	) =>
		Effect.sync((): EditorOriginFlowHighlight => {
			const readNodeHighlight = (node: EditorItemOriginItemNode) =>
				direction === "income"
					? readIncomeHighlight(flow, node)
					: readOutcomeHighlight(flow, node);
			if (selection.kind === "node") {
				const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
				return selectedNode === undefined
					? readEmptyHighlight()
					: readHighlightLevels(flow, readNodeHighlight(selectedNode), selectedNode.id);
			}

			const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
			if (selectedEdge === undefined) return readEmptyHighlight();
			const startNodeId = direction === "income" ? selectedEdge.source : selectedEdge.target;
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
			const highlight = readNodeHighlight(startNode);
			return readHighlightLevels(
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
		}),
);
