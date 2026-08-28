import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionQuantityProbability,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { createEditorEstimateIndexFx } from "~/editor/estimator/createEditorEstimateIndexFx";
import {
	createEditorEstimateExpectedRunsFx,
	type EditorEstimateExpectedRuns,
} from "~/editor/estimator/createEditorEstimateExpectedRunsFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";

export interface EditorEstimateRequirementGroup {
	consumed: number;
	readonly factId: string;
	oneTime: number;
	/** Additive live identities which cannot be shared by sibling roles. */
	distinctOneTime: number;
	ongoing: number;
	readonly sources: EditorAcquisitionRequirement["source"][];
}

export interface EditorEstimatePolicy {
	readonly factCount: number;
	readonly hasFactFx: (factId: string) => Effect.Effect<boolean>;
	readonly readCandidateRoutesFx: (
		factId: string,
	) => Effect.Effect<ReadonlyArray<EditorAcquisitionRoute>>;
	readonly chooseRequirementsFx: (
		route: EditorAcquisitionRoute,
		actionRuns: number,
	) => Effect.Effect<ReadonlyArray<EditorEstimateRequirementGroup> | undefined>;
	readonly chooseRouteFx: (
		factId: string,
		quantity: number,
	) => Effect.Effect<EditorAcquisitionRoute | undefined>;
	readonly readExpectedRunsFx: (
		distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
		quantity: number,
	) => Effect.Effect<number>;
	readonly readExpectedRunsJointFx: (
		input: Parameters<EditorEstimateExpectedRuns["read"]>[0],
	) => Effect.Effect<ReturnType<EditorEstimateExpectedRuns["read"]>>;
	readonly readRootQuantityFx: (
		factId: string,
	) => Effect.Effect<number | "unbounded" | undefined>;
	readonly readSeededComponentFx: (factId: string) => Effect.Effect<string | undefined>;
}

const requirementQuantity = (requirement: EditorAcquisitionRequirement, actionRuns: number) =>
	requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

/** Creates one deterministic complete-route selector over the canonical acquisition graph. */
export const createEditorEstimatePolicyFx = Effect.fn("createEditorEstimatePolicyFx")(
	(graph: EditorAcquisitionGraph) =>
		Effect.gen(function* () {
			const expectedRuns = yield* createEditorEstimateExpectedRunsFx();
			const scalarExpectedRunsByDistribution = new WeakMap<
				ReadonlyArray<EditorAcquisitionQuantityProbability>,
				Map<number, number>
			>();
			const readExpectedRuns = (
				distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
				quantity: number,
			) => {
				// Callers treat this sentinel as an unsupported route without allocating excess states.
				if (quantity > editorItemEstimateMaximumQuantity) return Number.NaN;
				const cachedByQuantity = scalarExpectedRunsByDistribution.get(distribution);
				const cached = cachedByQuantity?.get(quantity);
				if (cached !== undefined) return cached;
				const result = expectedRuns.read({
					demandByOutputGroupId: new Map([
						[
							"output",
							quantity,
						],
					]),
					distribution: distribution.map(({ probability, quantity }) => ({
						probability,
						quantities: [
							{
								outputGroupId: "output",
								quantity,
							},
						],
					})),
				});
				const runs = result.status === "complete" ? result.runs : Number.NaN;
				const byQuantity = cachedByQuantity ?? new Map<number, number>();
				byQuantity.set(quantity, runs);
				if (cachedByQuantity === undefined)
					scalarExpectedRunsByDistribution.set(distribution, byQuantity);
				return runs;
			};
			const index = yield* createEditorEstimateIndexFx(graph);
			const factIds = index.factIds;
			const roots = index.roots;
			const routesByFact = index.routesByFact;
			const componentByFact = index.componentByFact;
			const readEstimateRequirements = (route: EditorAcquisitionRoute) =>
				index.estimateRequirementsByRoute.get(route)!;
			const readCompleteFacts = (blockedFactIds: ReadonlySet<string>) => {
				const key = [
					...blockedFactIds,
				]
					.sort()
					.join("\u0000");
				const cached = completeFactsByBlockedKey.get(key);
				if (cached !== undefined) return cached;
				const complete = new Set(graph.roots.map(({ factId }) => factId));
				let pending = graph.routes.filter(
					(route) =>
						!blockedFactIds.has(route.output.factId) &&
						!index.unsupportedRoutes.has(route),
				);
				for (let iteration = 0; iteration < graph.factIds.length; iteration += 1) {
					let changed = false;
					const nextPending: EditorAcquisitionRoute[] = [];
					for (const route of pending) {
						const requirements = readEstimateRequirements(route);
						if (
							requirements.allOf.some(
								(requirement) => !complete.has(requirement.factId),
							) ||
							requirements.anyOf.some(
								(clause) =>
									!clause.some((requirement) => complete.has(requirement.factId)),
							)
						)
							nextPending.push(route);
						else if (!complete.has(route.output.factId)) {
							complete.add(route.output.factId);
							changed = true;
						}
					}
					if (!changed) break;
					pending = nextPending;
				}
				completeFactsByBlockedKey.set(key, complete);
				return complete;
			};
			const completeFactsByBlockedKey = new Map<string, ReadonlySet<string>>();
			const isCompleteRoute = (
				route: EditorAcquisitionRoute,
				blockedFactIds: ReadonlySet<string>,
			) => {
				if (index.unsupportedRoutes.has(route)) return false;
				const requirements = readEstimateRequirements(route);
				const satisfies = (complete: ReadonlySet<string>) =>
					requirements.allOf.every((requirement) => complete.has(requirement.factId)) &&
					requirements.anyOf.every((clause) =>
						clause.some((requirement) => complete.has(requirement.factId)),
					);
				const complete = readCompleteFacts(blockedFactIds);
				if (!satisfies(complete)) return false;
				const outputComponent =
					componentByFact.get(route.output.factId) ?? route.output.factId;
				const mayReenterOutputComponent =
					requirements.allOf.some(
						({ factId }) => (componentByFact.get(factId) ?? factId) === outputComponent,
					) ||
					requirements.anyOf.some((clause) =>
						clause
							.filter(({ factId }) => complete.has(factId))
							.every(
								({ factId }) =>
									(componentByFact.get(factId) ?? factId) === outputComponent,
							),
					);
				return (
					!mayReenterOutputComponent ||
					satisfies(
						readCompleteFacts(
							new Set([
								...blockedFactIds,
								route.output.factId,
							]),
						),
					)
				);
			};
			const isRouteStaticallyUnsupported = (route: EditorAcquisitionRoute) =>
				index.unsupportedRoutes.has(route);
			const unitCost = new Map<string, number>();
			for (const factId of graph.roots.map(({ factId }) => factId)) unitCost.set(factId, 0);
			for (let iteration = 0; iteration < index.factCount; iteration += 1) {
				let changed = false;
				for (const route of graph.routes) {
					if (isRouteStaticallyUnsupported(route)) continue;
					const outputRuns = readExpectedRuns(route.output.quantityDistribution, 1);
					if (!Number.isFinite(outputRuns)) continue;
					const actionRuns = outputRuns * route.runMultiplier;
					let dependencyCost = 0;
					const requirements = readEstimateRequirements(route);
					for (const requirement of requirements.allOf) {
						const requirementCost = unitCost.get(requirement.factId);
						if (requirementCost === undefined) {
							dependencyCost = Number.POSITIVE_INFINITY;
							break;
						}
						dependencyCost = Math.max(
							dependencyCost,
							requirementCost * requirementQuantity(requirement, actionRuns),
						);
					}
					for (const clause of requirements.anyOf)
						dependencyCost = Math.max(
							dependencyCost,
							Math.min(
								...clause.map((requirement) => {
									const requirementCost = unitCost.get(requirement.factId);
									return requirementCost === undefined
										? Number.POSITIVE_INFINITY
										: requirementCost *
												requirementQuantity(requirement, actionRuns);
								}),
							),
						);
					const cost = route.durationMs * actionRuns + dependencyCost;
					const current = unitCost.get(route.output.factId);
					if (Number.isFinite(cost) && (current === undefined || cost < current - 1e-9)) {
						unitCost.set(route.output.factId, cost);
						changed = true;
					}
				}
				if (!changed) break;
			}
			const quantityCostMemo = new Map<string, number>();
			const missingQuantity = (factId: string, quantity: number) => {
				const root = roots.get(factId);
				return root === "unbounded" ? 0 : Math.max(0, quantity - (root ?? 0));
			};
			function readFactCost(
				factId: string,
				quantity: number,
				activeComponentId: string,
				blockedFactIds: ReadonlySet<string>,
				costMemo: Map<string, number>,
			): number {
				const missing = missingQuantity(factId, quantity);
				if (missing <= 1e-9) return 0;
				if (blockedFactIds.has(factId)) return Number.POSITIVE_INFINITY;
				const componentId = componentByFact.get(factId) ?? factId;
				if (componentId === activeComponentId)
					return (unitCost.get(factId) ?? Number.POSITIVE_INFINITY) * missing;
				const normalized = Math.round(missing * 1e9) / 1e9;
				const blockedTop = blockedFactIds.values().next().value ?? "";
				const key = `${factId}\u0000${normalized}\u0000${activeComponentId}\u0000${blockedTop}`;
				const memoized = costMemo.get(key);
				if (memoized !== undefined) return memoized;
				const cost = Math.min(
					...(routesByFact.get(factId) ?? [])
						.filter((route) => isCompleteRoute(route, blockedFactIds))
						.map((route) =>
							readRouteCost(route, missing, componentId, blockedFactIds, costMemo),
						),
				);
				costMemo.set(key, cost);
				return cost;
			}

			function chooseRequirements(
				route: EditorAcquisitionRoute,
				actionRuns: number,
				activeComponentId = componentByFact.get(route.output.factId) ?? route.output.factId,
				blockedFactIds: ReadonlySet<string> = new Set(),
				costMemo = quantityCostMemo,
			) {
				const requirements: Array<{
					readonly requirement: EditorAcquisitionRequirement;
				}> = readEstimateRequirements(route).allOf.map((requirement) => ({
					requirement,
				}));
				for (const clause of readEstimateRequirements(route).anyOf) {
					const selected = [
						...clause,
					].sort((left, right) => {
						const readCost = (requirement: EditorAcquisitionRequirement) => {
							if (
								(componentByFact.get(requirement.factId) ?? requirement.factId) ===
									activeComponentId &&
								!readCompleteFacts(
									new Set([
										...blockedFactIds,
										route.output.factId,
									]),
								).has(requirement.factId)
							)
								return Number.POSITIVE_INFINITY;
							const quantity = requirementQuantity(requirement, actionRuns);
							return readFactCost(
								requirement.factId,
								quantity,
								activeComponentId,
								blockedFactIds,
								costMemo,
							);
						};
						const leftCost = readCost(left);
						const rightCost = readCost(right);
						return leftCost - rightCost || left.factId.localeCompare(right.factId);
					})[0];
					if (
						selected === undefined ||
						!Number.isFinite(
							readFactCost(
								selected.factId,
								requirementQuantity(selected, actionRuns),
								activeComponentId,
								blockedFactIds,
								costMemo,
							),
						)
					)
						return undefined;
					requirements.push({
						requirement: selected,
					});
				}
				const groups = new Map<string, EditorEstimateRequirementGroup>();
				for (const { requirement } of requirements) {
					const group = groups.get(requirement.factId) ?? {
						consumed: 0,
						factId: requirement.factId,
						oneTime: 0,
						distinctOneTime: 0,
						ongoing: 0,
						sources: [],
					};
					if (requirement.usage === "consume")
						group.consumed += requirementQuantity(requirement, actionRuns);
					if (requirement.usage === "one-time") {
						if (requirement.identity === "distinct")
							group.distinctOneTime += requirement.quantity;
						else group.oneTime = Math.max(group.oneTime, requirement.quantity);
						group.oneTime = Math.max(group.oneTime, group.distinctOneTime);
					}
					if (requirement.usage === "ongoing")
						group.ongoing = Math.max(group.ongoing, requirement.quantity);
					if (!group.sources.includes(requirement.source)) {
						group.sources.push(requirement.source);
						group.sources.sort();
					}
					groups.set(group.factId, group);
				}
				const result = [
					...groups.values(),
				].sort((left, right) => left.factId.localeCompare(right.factId));
				return result;
			}

			function readRouteCost(
				route: EditorAcquisitionRoute,
				quantity: number,
				activeComponentId = componentByFact.get(route.output.factId) ?? route.output.factId,
				blockedFactIds: ReadonlySet<string> = new Set(),
				costMemo = quantityCostMemo,
			) {
				if (!isCompleteRoute(route, blockedFactIds)) return Number.POSITIVE_INFINITY;
				const outputRuns = readExpectedRuns(route.output.quantityDistribution, quantity);
				if (!Number.isFinite(outputRuns)) return Number.POSITIVE_INFINITY;
				const actionRuns = outputRuns * route.runMultiplier;
				const groups = chooseRequirements(
					route,
					actionRuns,
					activeComponentId,
					blockedFactIds,
					costMemo,
				);
				if (groups === undefined) return Number.POSITIVE_INFINITY;
				let dependencyCost = 0;
				for (const group of groups) {
					const groupCost = readFactCost(
						group.factId,
						group.consumed + Math.max(group.oneTime, group.ongoing),
						activeComponentId,
						blockedFactIds,
						costMemo,
					);
					if (!Number.isFinite(groupCost)) return groupCost;
					dependencyCost = Math.max(dependencyCost, groupCost);
				}
				return route.durationMs * actionRuns + dependencyCost;
			}

			const chooseRoute = (factId: string, quantity: number) => {
				const missing = missingQuantity(factId, quantity);
				return [
					...(routesByFact.get(factId) ?? []),
				]
					.map((route) => ({
						cost: readRouteCost(
							route,
							missing,
							componentByFact.get(factId) ?? factId,
							new Set(),
							quantityCostMemo,
						),
						route,
					}))
					.filter(({ cost }) => Number.isFinite(cost))
					.sort(
						(left, right) =>
							left.cost - right.cost || left.route.id.localeCompare(right.route.id),
					)[0]?.route;
			};
			return {
				hasFactFx: (factId: string) => Effect.sync(() => factIds.has(factId)),
				factCount: index.factCount,
				readCandidateRoutesFx: (factId: string) =>
					Effect.sync(() => routesByFact.get(factId) ?? []),
				chooseRequirementsFx: (route: EditorAcquisitionRoute, actionRuns: number) =>
					Effect.sync(() => chooseRequirements(route, actionRuns)),
				chooseRouteFx: (factId: string, quantity: number) =>
					Effect.sync(() => chooseRoute(factId, quantity)),
				readExpectedRunsFx: (
					distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
					quantity: number,
				) => Effect.sync(() => readExpectedRuns(distribution, quantity)),
				readExpectedRunsJointFx: (
					input: Parameters<EditorEstimateExpectedRuns["read"]>[0],
				) => Effect.sync(() => expectedRuns.read(input)),
				readRootQuantityFx: (factId: string) => Effect.sync(() => roots.get(factId)),
				readSeededComponentFx: (factId: string) =>
					Effect.sync(() => index.seededComponentByFact.get(factId)),
			};
		}),
);
