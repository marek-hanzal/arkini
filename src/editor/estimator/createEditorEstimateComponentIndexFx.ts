import { Effect } from "effect";

import type { EditorAcquisitionGraph } from "~/editor/EditorAcquisitionGraph";

export interface EditorEstimateComponentIndex {
	readonly componentByFact: ReadonlyMap<string, string>;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
}

/** Builds static strongly-connected-component membership and authored-seed evidence. */
export const createEditorEstimateComponentIndexFx = Effect.fn(
	"createEditorEstimateComponentIndexFx",
)((graph: EditorAcquisitionGraph) =>
	Effect.sync((): EditorEstimateComponentIndex => {
		const rootFactIds = new Set(graph.roots.map(({ factId }) => factId));
		const adjacency = new Map<string, Set<string>>(
			graph.factIds.map((factId) => [
				factId,
				new Set<string>(),
			]),
		);
		for (const route of graph.routes) {
			for (const requirement of [
				...route.requirements.allOf,
				...route.requirements.anyOf.flat(),
			])
				adjacency.get(route.output.factId)?.add(requirement.factId);
			for (const chargeUse of route.chargeUses ?? [])
				adjacency.get(route.output.factId)?.add(chargeUse.payerFactId);
		}
		const reachableByFact = new Map<string, Set<string>>();
		for (const id of graph.factIds) {
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
		for (const id of graph.factIds) {
			const component = graph.factIds
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
