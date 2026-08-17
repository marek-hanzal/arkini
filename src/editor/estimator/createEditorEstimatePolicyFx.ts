import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionQuantityProbability,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { createEditorEstimateComponentIndexFx } from "~/editor/estimator/createEditorEstimateComponentIndexFx";
import {
	createEditorEstimateExpectedRunsFx,
	type EditorEstimateExpectedRuns,
} from "~/editor/estimator/createEditorEstimateExpectedRunsFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";

export interface EditorEstimateRequirementGroup {
	readonly anyOfClauseIndexes: number[];
	charged: boolean;
	consumed: number;
	readonly factId: string;
	oneTime: number;
	/** Additive live identities which cannot be shared by sibling roles. */
	distinctOneTime: number;
	ongoing: number;
	readonly sources: EditorAcquisitionRequirement["source"][];
}

export interface EditorEstimatePolicy {
	readonly expectedRuns: EditorEstimateExpectedRuns;
	readonly factIds: ReadonlySet<string>;
	readonly preferredRouteIdByFact: ReadonlyMap<string, string>;
	readonly roots: ReadonlyMap<string, number | "unbounded">;
	readonly routesByFact: ReadonlyMap<string, ReadonlyArray<EditorAcquisitionRoute>>;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
	readonly chooseRequirements: (
		route: EditorAcquisitionRoute,
		actionRuns: number,
		producedQuantity: number,
	) => ReadonlyArray<EditorEstimateRequirementGroup> | undefined;
	readonly chooseRoute: (
		factId: string,
		quantity: number,
		blockedFactIds?: ReadonlySet<string>,
	) => EditorAcquisitionRoute | undefined;
	readonly readExpectedRuns: (
		distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
		quantity: number,
	) => number;
}

const requirementQuantity = (requirement: EditorAcquisitionRequirement, actionRuns: number) =>
	requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

const isRouteStaticallyUnsupported = (route: EditorAcquisitionRoute) =>
	route.operation?.outputCompilation === "state-space-unsupported" ||
	(route.requirements.unsupported?.length ?? 0) > 0 ||
	(route.chargeUses?.some(
		({ accounting, usableActionRuns }) =>
			accounting === "multi-payer-unsupported" || usableActionRuns <= 0,
	) ??
		false) ||
	((route.chargeUses?.length ?? 0) > 0 &&
		Math.min(...route.output.quantityDistribution.map(({ quantity }) => quantity)) <= 0);

/** Creates one deterministic complete-route selector over the canonical acquisition graph. */
export const createEditorEstimatePolicyFx = Effect.fn("createEditorEstimatePolicyFx")(
	(graph: EditorAcquisitionGraph) =>
		Effect.gen(function* () {
			const expectedRuns = yield* createEditorEstimateExpectedRunsFx();
			const readExpectedRuns = (
				distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
				quantity: number,
			) => {
				// Callers treat this sentinel as an unsupported route without allocating excess states.
				if (quantity > editorItemEstimateMaximumQuantity) return Number.NaN;
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
				return result.status === "complete" ? result.runs : Number.NaN;
			};
			const roots = new Map(
				graph.roots.map(
					({ factId, quantity }) =>
						[
							factId,
							quantity,
						] as const,
				),
			);
			const routesByFact = new Map<string, EditorAcquisitionRoute[]>();
			for (const route of graph.routes) {
				const routes = routesByFact.get(route.output.factId) ?? [];
				routes.push(route);
				routesByFact.set(route.output.factId, routes);
			}
			for (const routes of routesByFact.values())
				routes.sort((left, right) => left.id.localeCompare(right.id));
			const { componentByFact, seededComponentByFact } =
				yield* createEditorEstimateComponentIndexFx(graph);
			const unitCost = new Map<string, number>();
			const preferredRouteIdByFact = new Map<string, string>();
			for (const { factId } of graph.roots) unitCost.set(factId, 0);
			for (let iteration = 0; iteration < graph.factIds.length; iteration += 1) {
				let changed = false;
				for (const route of graph.routes) {
					if (isRouteStaticallyUnsupported(route)) continue;
					const outputRuns = readExpectedRuns(route.output.quantityDistribution, 1);
					if (!Number.isFinite(outputRuns)) continue;
					const actionRuns = outputRuns * route.runMultiplier;
					let cost = route.durationMs * actionRuns;
					for (const requirement of route.requirements.allOf) {
						const dependencyCost = unitCost.get(requirement.factId);
						if (dependencyCost === undefined) {
							cost = Number.POSITIVE_INFINITY;
							break;
						}
						cost += dependencyCost * requirementQuantity(requirement, actionRuns);
					}
					for (const clause of route.requirements.anyOf) {
						cost += Math.min(
							...clause.map((requirement) => {
								const dependencyCost = unitCost.get(requirement.factId);
								return dependencyCost === undefined
									? Number.POSITIVE_INFINITY
									: dependencyCost * requirementQuantity(requirement, actionRuns);
							}),
						);
					}
					for (const chargeUse of route.chargeUses ?? []) {
						const dependencyCost = unitCost.get(chargeUse.payerFactId);
						cost +=
							dependencyCost === undefined
								? Number.POSITIVE_INFINITY
								: dependencyCost *
									Math.ceil(actionRuns / chargeUse.usableActionRuns - 1e-9);
					}
					const current = unitCost.get(route.output.factId);
					const preferredRouteId = preferredRouteIdByFact.get(route.output.factId);
					if (
						Number.isFinite(cost) &&
						(current === undefined ||
							cost < current - 1e-9 ||
							(Math.abs(cost - current) <= 1e-9 &&
								(preferredRouteId === undefined || route.id < preferredRouteId)))
					) {
						unitCost.set(route.output.factId, cost);
						preferredRouteIdByFact.set(route.output.factId, route.id);
						if (current === undefined || Math.abs(cost - current) > 1e-9)
							changed = true;
					}
				}
				if (!changed) break;
			}
			const quantityCostMemo = new Map<string, number>();
			const completeFactsByBlockedKey = new Map<string, ReadonlySet<string>>();
			const missingQuantity = (factId: string, quantity: number) => {
				const root = roots.get(factId);
				return root === "unbounded" ? 0 : Math.max(0, quantity - (root ?? 0));
			};
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
						!isRouteStaticallyUnsupported(route),
				);
				for (let iteration = 0; iteration < graph.factIds.length; iteration += 1) {
					let changed = false;
					const nextPending: EditorAcquisitionRoute[] = [];
					for (const route of pending) {
						if (
							route.requirements.allOf.some(
								(requirement) => !complete.has(requirement.factId),
							) ||
							route.requirements.anyOf.some(
								(clause) =>
									!clause.some((requirement) => complete.has(requirement.factId)),
							) ||
							(route.chargeUses?.some(
								({ payerFactId }) => !complete.has(payerFactId),
							) ??
								false)
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
			const isCompleteRoute = (
				route: EditorAcquisitionRoute,
				blockedFactIds: ReadonlySet<string>,
			) => {
				if (isRouteStaticallyUnsupported(route)) return false;
				const satisfies = (complete: ReadonlySet<string>) =>
					route.requirements.allOf.every((requirement) =>
						complete.has(requirement.factId),
					) &&
					route.requirements.anyOf.every((clause) =>
						clause.some((requirement) => complete.has(requirement.factId)),
					) &&
					(route.chargeUses?.every(({ payerFactId }) => complete.has(payerFactId)) ??
						true);
				const complete = readCompleteFacts(blockedFactIds);
				if (!satisfies(complete)) return false;
				const readComponent = (factId: string) => componentByFact.get(factId) ?? factId;
				const outputComponent = readComponent(route.output.factId);
				const mayReenterOutputComponent =
					route.requirements.allOf.some(
						({ factId }) => readComponent(factId) === outputComponent,
					) ||
					route.requirements.anyOf.some((clause) =>
						clause
							.filter(({ factId }) => complete.has(factId))
							.every(({ factId }) => readComponent(factId) === outputComponent),
					) ||
					(route.chargeUses?.some(
						({ payerFactId }) => readComponent(payerFactId) === outputComponent,
					) ??
						false);
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
				const key = `${factId}\u0000${normalized}\u0000${[
					...blockedFactIds,
				]
					.sort()
					.join("\u0001")}`;
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
				producedQuantity = 0,
			) {
				const requirements: Array<{
					readonly clauseIndex?: number;
					readonly requirement: EditorAcquisitionRequirement;
				}> = route.requirements.allOf.map((requirement) => ({
					requirement,
				}));
				for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
					const selected = [
						...clause,
					].sort((left, right) => {
						const readCost = (requirement: EditorAcquisitionRequirement) => {
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
						clauseIndex,
						requirement: selected,
					});
				}
				const groups = new Map<string, EditorEstimateRequirementGroup>();
				for (const { clauseIndex, requirement } of requirements) {
					const group = groups.get(requirement.factId) ?? {
						anyOfClauseIndexes: [],
						charged: false,
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
					if (clauseIndex !== undefined) group.anyOfClauseIndexes.push(clauseIndex);
					if (!group.sources.includes(requirement.source)) {
						group.sources.push(requirement.source);
						group.sources.sort();
					}
					groups.set(group.factId, group);
				}
				for (const chargeUse of route.chargeUses ?? []) {
					const group = groups.get(chargeUse.payerFactId) ?? {
						anyOfClauseIndexes: [],
						charged: false,
						consumed: 0,
						factId: chargeUse.payerFactId,
						oneTime: 0,
						distinctOneTime: 0,
						ongoing: 0,
						sources: [],
					};
					group.charged = true;
					if (!group.sources.includes("charged-item")) {
						group.sources.push("charged-item");
						group.sources.sort();
					}
					const minimumOutput = Math.min(
						...route.output.quantityDistribution.map(({ quantity }) => quantity),
					);
					const conservativeActionRuns =
						minimumOutput > 0
							? Math.ceil(producedQuantity / minimumOutput - 1e-9) *
								route.runMultiplier
							: 0;
					group.oneTime = Math.max(
						group.oneTime,
						Math.ceil(
							Math.max(actionRuns, conservativeActionRuns) /
								chargeUse.usableActionRuns -
								1e-9,
						),
					);
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
					quantity,
				);
				if (groups === undefined) return Number.POSITIVE_INFINITY;
				let cost = route.durationMs * actionRuns;
				for (const group of groups) {
					const dependencyCost = readFactCost(
						group.factId,
						group.consumed + Math.max(group.oneTime, group.ongoing),
						activeComponentId,
						blockedFactIds,
						costMemo,
					);
					if (!Number.isFinite(dependencyCost)) return dependencyCost;
					cost += dependencyCost;
				}
				return cost;
			}

			const chooseRoute = (
				factId: string,
				quantity: number,
				blockedFactIds: ReadonlySet<string> = new Set(),
			) => {
				const missing = missingQuantity(factId, quantity);
				return [
					...(routesByFact.get(factId) ?? []),
				]
					.map((route) => ({
						cost: readRouteCost(
							route,
							missing,
							componentByFact.get(factId) ?? factId,
							blockedFactIds,
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
				chooseRequirements: (
					route: EditorAcquisitionRoute,
					actionRuns: number,
					producedQuantity: number,
				) =>
					chooseRequirements(
						route,
						actionRuns,
						undefined,
						undefined,
						undefined,
						producedQuantity,
					),
				chooseRoute,
				expectedRuns,
				factIds: new Set(graph.factIds),
				preferredRouteIdByFact,
				readExpectedRuns,
				roots,
				routesByFact,
				seededComponentByFact,
			};
		}),
);
