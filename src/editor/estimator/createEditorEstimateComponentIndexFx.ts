import { Effect, Graph } from "effect";

export interface EditorEstimateComponentIndex {
	readonly componentByFact: ReadonlyMap<string, string>;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
}

export interface EditorEstimateComponentIndexInput {
	readonly dependencyEdges: ReadonlyArray<
		readonly [
			fromFactId: string,
			toFactId: string,
		]
	>;
	readonly factIds: ReadonlyArray<string>;
	readonly rootFactIds: ReadonlySet<string>;
}

/** Builds static strongly-connected-component membership and authored-seed evidence. */
export const createEditorEstimateComponentIndexFx = Effect.fn(
	"createEditorEstimateComponentIndexFx",
)((input: EditorEstimateComponentIndexInput) =>
	Effect.sync((): EditorEstimateComponentIndex => {
		const { dependencyEdges, factIds, rootFactIds } = input;
		const nodeByFact = new Map<string, Graph.NodeIndex>();
		const factByNode = new Map<Graph.NodeIndex, string>();
		const graph = Graph.directed<string, void>((mutable) => {
			for (const factId of [
				...new Set(factIds),
			].sort()) {
				const node = Graph.addNode(mutable, factId);
				nodeByFact.set(factId, node);
				factByNode.set(node, factId);
			}
			for (const [fromFactId, toFactId] of dependencyEdges) {
				const from = nodeByFact.get(fromFactId);
				const to = nodeByFact.get(toFactId);
				if (from !== undefined && to !== undefined)
					Graph.addEdge(mutable, from, to, undefined);
			}
		});
		const components = Graph.stronglyConnectedComponents(graph)
			.map((nodes) =>
				nodes
					.map((node) => factByNode.get(node))
					.filter((factId): factId is string => factId !== undefined)
					.sort(),
			)
			.sort(([left = ""], [right = ""]) => left.localeCompare(right));
		const componentByFact = new Map<string, string>();
		const seededComponentByFact = new Map<string, string>();
		for (const component of components) {
			const componentId = component[0];
			if (componentId === undefined) continue;
			const seeded = component.some((factId) => rootFactIds.has(factId));
			for (const factId of component) {
				componentByFact.set(factId, componentId);
				if (seeded) seededComponentByFact.set(factId, componentId);
			}
		}
		return {
			componentByFact,
			seededComponentByFact,
		};
	}),
);
