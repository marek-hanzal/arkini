import { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import type { IdSchema } from "~/engine/common/schema/IdSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readActionId = (action: PlannerSearchAction["action"]) => {
	switch (action.kind) {
		case "line":
			return JSON.stringify([
				action.kind,
				action.ownerItemId,
				action.lineId,
			]);
		case "merge":
			return JSON.stringify([
				action.kind,
				action.sourceItemId,
				action.targetItemId,
				action.mergeIndex,
			]);
		case "temporary-expiry":
			return JSON.stringify([
				action.kind,
				action.itemId,
			]);
	}
};

const readActionOutputWitness = (
	route: PlannerAcquisitionRoute,
): PlannerSearchAction["outputWitness"] => {
	const witness = route.output.witness;
	if (witness === undefined) return undefined;

	const source = (() => {
		switch (route.kind) {
			case "line-output":
				return {
					lineId: route.action.lineId,
					ownerItemId: route.action.ownerItemId,
					type: "line" as const,
				};
			case "line-charge-depletion":
				return {
					itemId: route.chargedItemId,
					type: "charges" as const,
				};
			case "merge-output":
				return {
					sourceItemId: route.action.sourceItemId,
					targetItemId: route.action.targetItemId,
					type: "merge" as const,
				};
			case "temporary-expiry":
				return {
					itemId: route.action.itemId,
					type: "temporary-expiry" as const,
				};
		}
	})();

	return {
		outputItemId: route.output.itemId,
		routeId: route.id,
		source,
		statistics: {
			expectedQuantity: route.output.expectedQuantity,
			maximumQuantity: route.output.maximumQuantity,
			maximumQuantityProbability: route.output.maximumQuantityProbability,
			occurrenceProbability: route.output.occurrenceProbability,
			quantityDistribution: route.output.quantityDistribution,
			selection: route.output.selection,
			stochastic: route.output.stochastic,
		},
		witness,
		witnessId: route.output.witnessId,
	};
};

/** Projects acquisition routes into deterministic canonical or existential engine actions. */
export const readPlannerSearchActionsFx = Effect.fn("readPlannerSearchActionsFx")(
	({
		graph,
		routes,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
	}) =>
		Effect.sync((): ReadonlyArray<PlannerSearchAction> => {
			const canonicalByActionId = new Map<
				string,
				{
					action: PlannerSearchAction["action"];
					depth: number;
					outputItemIds: Set<IdSchema.Type>;
					routeIds: string[];
				}
			>();
			const existentialByResolutionId = new Map<string, PlannerSearchAction>();

			for (const route of routes) {
				const actionId = readActionId(route.action);
				const depth = graph.routeDepthById.get(route.id) ?? Number.POSITIVE_INFINITY;
				if (!route.output.stochastic) {
					const candidate = canonicalByActionId.get(actionId) ?? {
						action: route.action,
						depth,
						outputItemIds: new Set<IdSchema.Type>(),
						routeIds: [],
					};
					candidate.depth = Math.min(candidate.depth, depth);
					candidate.outputItemIds.add(route.output.itemId);
					candidate.routeIds.push(route.id);
					canonicalByActionId.set(actionId, candidate);
					continue;
				}

				const outputWitness = readActionOutputWitness(route);
				if (outputWitness === undefined)
					throw new Error(`Stochastic planner route ${route.id} has no output witness.`);
				const resolutionId = JSON.stringify([
					actionId,
					outputWitness.source,
					route.output.itemId,
					route.output.resolutionId,
				]);
				const candidate: PlannerSearchAction = {
					action: route.action,
					actionId,
					depth,
					id: JSON.stringify([
						"output-witness",
						actionId,
						route.id,
					]),
					outputItemIds: [
						route.output.itemId,
					],
					outputMode: "existential",
					outputWitness,
					routeIds: [
						route.id,
					],
				};
				const existing = existentialByResolutionId.get(resolutionId);
				if (existing === undefined || existing.outputMode !== "existential") {
					existentialByResolutionId.set(resolutionId, candidate);
					continue;
				}

				const existingProbability =
					existing.outputWitness.statistics.maximumQuantityProbability;
				const candidateProbability = outputWitness.statistics.maximumQuantityProbability;
				const preferred =
					candidateProbability > existingProbability ||
					(candidateProbability === existingProbability &&
						(outputWitness.statistics.occurrenceProbability >
							existing.outputWitness.statistics.occurrenceProbability ||
							(outputWitness.statistics.occurrenceProbability ===
								existing.outputWitness.statistics.occurrenceProbability &&
								compareIds(candidate.id, existing.id) < 0)))
						? candidate
						: existing;
				existentialByResolutionId.set(resolutionId, {
					...preferred,
					depth: Math.min(existing.depth, candidate.depth),
					routeIds: [
						...new Set([
							...existing.routeIds,
							...candidate.routeIds,
						]),
					].sort(compareIds),
				});
			}

			const canonical = [
				...canonicalByActionId,
			].map(
				([actionId, candidate]): PlannerSearchAction => ({
					action: candidate.action,
					actionId,
					depth: candidate.depth,
					id: actionId,
					outputItemIds: [
						...candidate.outputItemIds,
					].sort(compareIds),
					outputMode: "canonical",
					routeIds: candidate.routeIds.sort(compareIds),
				}),
			);

			return [
				...canonical,
				...existentialByResolutionId.values(),
			].sort((left, right) => left.depth - right.depth || compareIds(left.id, right.id));
		}),
);
