import { Graph, Order } from "effect";

import type { LayoutInput } from "~/flow-layout/type/Layout";
import type { DirectedPair } from "~/flow-layout/type/LayoutTopology";

/** Collapses feedback cycles and assigns a stable forward rank to each flow node. */
export const readRanksFn = (flow: LayoutInput, directedPairs: ReadonlyArray<DirectedPair>) => {
	const nodeIds = flow.nodes.map(({ id }) => id).sort((left, right) => Order.String(left, right));
	const graphNodeById = new Map<string, Graph.NodeIndex>();
	const idByGraphNode = new Map<Graph.NodeIndex, string>();
	const graph = Graph.directed<string, void>((mutable) => {
		for (const id of nodeIds) {
			const node = Graph.addNode(mutable, id);
			graphNodeById.set(id, node);
			idByGraphNode.set(node, id);
		}
		for (const { source, target } of directedPairs) {
			const sourceNode = graphNodeById.get(source);
			const targetNode = graphNodeById.get(target);
			if (sourceNode !== undefined && targetNode !== undefined)
				Graph.addEdge(mutable, sourceNode, targetNode, undefined);
		}
	});
	const components = Graph.stronglyConnectedComponents(graph)
		.map((nodes) =>
			nodes
				.map((node) => idByGraphNode.get(node))
				.filter((id): id is string => id !== undefined)
				.sort((left, right) => Order.String(left, right)),
		)
		.sort(([left = ""], [right = ""]) => Order.String(left, right));
	const componentById = new Map<string, string>();
	for (const component of components) {
		const componentId = component[0];
		if (componentId === undefined) continue;
		for (const id of component) componentById.set(id, componentId);
	}

	const componentNodeById = new Map<string, Graph.NodeIndex>();
	const componentIdByNode = new Map<Graph.NodeIndex, string>();
	const componentEdges = new Set<string>();
	const componentGraph = Graph.directed<string, void>((mutable) => {
		for (const [componentId] of components) {
			if (componentId === undefined) continue;
			const node = Graph.addNode(mutable, componentId);
			componentNodeById.set(componentId, node);
			componentIdByNode.set(node, componentId);
		}
		for (const { source, target } of directedPairs) {
			const sourceComponentId = componentById.get(source);
			const targetComponentId = componentById.get(target);
			if (
				sourceComponentId === undefined ||
				targetComponentId === undefined ||
				sourceComponentId === targetComponentId
			)
				continue;
			const edgeId = `${sourceComponentId}\u0000${targetComponentId}`;
			if (componentEdges.has(edgeId)) continue;
			componentEdges.add(edgeId);
			Graph.addEdge(
				mutable,
				componentNodeById.get(sourceComponentId)!,
				componentNodeById.get(targetComponentId)!,
				undefined,
			);
		}
	});
	const rankByComponent = new Map(
		components.map(([id = ""]) => [
			id,
			0,
		]),
	);
	for (const [componentNode, componentId] of Graph.entries(Graph.topo(componentGraph))) {
		for (const targetNode of Graph.successors(componentGraph, componentNode)) {
			const targetId = componentIdByNode.get(targetNode);
			if (targetId === undefined) continue;
			rankByComponent.set(
				targetId,
				Math.max(
					rankByComponent.get(targetId) ?? 0,
					(rankByComponent.get(componentId) ?? 0) + 1,
				),
			);
		}
	}
	return new Map(
		nodeIds.map(
			(id) =>
				[
					id,
					rankByComponent.get(componentById.get(id) ?? "") ?? 0,
				] as const,
		),
	);
};
