import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/editor/origin-flow/EditorItemOriginFlow";
import { EdgeOrder, type Highlight } from "~/ui/item/editor/origin-flow/Highlight";

/** Reads every direct producer branch and one deterministic acquisition proof below each branch. */
export const readOutputHighlightFn = (
	flow: EditorItemOriginFlow,
	startNode: EditorItemOriginItemNode,
): Highlight => {
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
	for (const edge of [
		...(outputEdgesByTarget.get(startNode.id) ?? []),
	].sort(EdgeOrder)) {
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

			const directOutputEdgesForItem = [
				...(outputEdgesByTarget.get(itemNode.id) ?? []),
			].sort(EdgeOrder);
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
			for (const edge of [
				...(inputEdgesByOperation.get(operationId) ?? []),
			].sort(EdgeOrder)) {
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
