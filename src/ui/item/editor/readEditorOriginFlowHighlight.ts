import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";

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
	readonly branchIndexByEdgeId: ReadonlyMap<string, number>;
	readonly edgeIds: ReadonlySet<string>;
	readonly nodeIds: ReadonlySet<string>;
}

interface FlowNodePosition {
	readonly flowOrder: number;
}

const readEmptyHighlight = (): EditorOriginFlowHighlight => ({
	branchIndexByEdgeId: new Map(),
	edgeIds: new Set(),
	nodeIds: new Set(),
});

const sortEdges = (edges: ReadonlyArray<EditorItemOriginEdge>) =>
	[
		...edges,
	].sort(
		(left, right) =>
			left.operationId.localeCompare(right.operationId) || left.id.localeCompare(right.id),
	);

/** Reads the complete Income ancestry through operations embedded in their owning item nodes. */
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
	for (const edge of flow.edges) {
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
	const branchIndexByEdgeId = new Map<string, number>();
	if (startNode.starterScopes.length > 0)
		return {
			branchIndexByEdgeId,
			edgeIds,
			nodeIds,
		};

	const directOutputEdges = sortEdges(outputEdgesByTarget.get(startNode.id) ?? []);
	const directEdgesByOperation = new Map<string, EditorItemOriginEdge[]>();
	for (const edge of directOutputEdges) {
		const edges = directEdgesByOperation.get(edge.operationId) ?? [];
		edges.push(edge);
		directEdgesByOperation.set(edge.operationId, edges);
	}
	const directBranches = [
		...directEdgesByOperation.entries(),
	].sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

	const tracedItems = new Set<string>([
		startNode.id,
	]);
	const tracedOperations = new Set<string>();
	const markEdge = (edge: EditorItemOriginEdge, branchIndex: number) => {
		edgeIds.add(edge.id);
		if (!branchIndexByEdgeId.has(edge.id)) branchIndexByEdgeId.set(edge.id, branchIndex);
	};
	const traceOperation = (outputEdge: EditorItemOriginEdge, branchIndex: number) => {
		if (tracedOperations.has(outputEdge.operationId)) return;
		tracedOperations.add(outputEdge.operationId);
		const ownerNode = nodeById.get(outputEdge.source);
		if (ownerNode !== undefined) traceItem(ownerNode, branchIndex);
		for (const edge of sortEdges(inputEdgesByOperation.get(outputEdge.operationId) ?? [])) {
			markEdge(edge, branchIndex);
			const requirementNode = nodeById.get(edge.source);
			if (requirementNode !== undefined) traceItem(requirementNode, branchIndex);
		}
	};
	const traceItem = (itemNode: EditorItemOriginItemNode, branchIndex: number) => {
		nodeIds.add(itemNode.id);
		if (itemNode.starterScopes.length > 0 || tracedItems.has(itemNode.id)) return;
		tracedItems.add(itemNode.id);
		for (const outputEdge of sortEdges(outputEdgesByTarget.get(itemNode.id) ?? [])) {
			markEdge(outputEdge, branchIndex);
			traceOperation(outputEdge, branchIndex);
		}
	};

	for (const [branchIndex, [, branchOutputEdges]] of directBranches.entries()) {
		for (const outputEdge of branchOutputEdges) markEdge(outputEdge, branchIndex);
		const representative = branchOutputEdges[0];
		if (representative !== undefined) traceOperation(representative, branchIndex);
	}

	return {
		branchIndexByEdgeId,
		edgeIds,
		nodeIds,
	};
};

/** Reads the complete Income ancestry selected by an item or connection. */
export const readEditorOriginFlowHighlight = (
	flow: EditorItemOriginFlow,
	_positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
): EditorOriginFlowHighlight => {
	if (selection.kind === "node") {
		const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
		return selectedNode === undefined
			? readEmptyHighlight()
			: readIncomeHighlight(flow, selectedNode);
	}

	const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
	if (selectedEdge === undefined) return readEmptyHighlight();
	const startNode = flow.nodes.find(({ id }) => id === selectedEdge.source);
	if (startNode === undefined)
		return {
			branchIndexByEdgeId: new Map(),
			edgeIds: new Set([
				selectedEdge.id,
			]),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
			]),
		};
	const highlight = readIncomeHighlight(flow, startNode);
	return {
		branchIndexByEdgeId: new Map(),
		edgeIds: new Set([
			selectedEdge.id,
			...highlight.edgeIds,
		]),
		nodeIds: new Set([
			selectedEdge.target,
			...highlight.nodeIds,
		]),
	};
};
