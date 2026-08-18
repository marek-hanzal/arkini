import { Effect } from "effect";

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
		const adjacency = new Map<string, Set<string>>(
			factIds.map((factId) => [
				factId,
				new Set<string>(),
			]),
		);
		for (const [fromFactId, toFactId] of dependencyEdges)
			adjacency.get(fromFactId)?.add(toFactId);
		const reachableByFact = new Map<string, Set<string>>();
		for (const id of factIds) {
			const reachable = new Set<string>();
			const pending = [
				id,
			];
			while (pending.length > 0) {
				const current = pending.pop();
				if (current === undefined || reachable.has(current)) continue;
				reachable.add(current);
				pending.push(...(adjacency.get(current) ?? []));
			}
			reachableByFact.set(id, reachable);
		}
		const componentByFact = new Map<string, string>();
		const seededComponentIds = new Set<string>();
		for (const id of factIds) {
			const component = factIds
				.filter(
					(candidate) =>
						reachableByFact.get(id)?.has(candidate) === true &&
						reachableByFact.get(candidate)?.has(id) === true,
				)
				.sort();
			const componentId = component[0] ?? id;
			componentByFact.set(id, componentId);
			if (component.some((factId) => rootFactIds.has(factId)))
				seededComponentIds.add(componentId);
		}
		return {
			componentByFact,
			seededComponentByFact: new Map(
				[
					...componentByFact,
				].filter(([, componentId]) => seededComponentIds.has(componentId)),
			),
		};
	}),
);
