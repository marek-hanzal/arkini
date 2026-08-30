import { Order } from "effect";

import { groupEstimateRequirementsFn } from "~/estimate-demand/fn/groupEstimateRequirementsFn";
import { projectEstimateWitnessFn } from "~/estimate-projection/fn/projectEstimateWitnessFn";
import type { EstimateTopology } from "~/estimate/fn/createEstimateTopologyFn";
import {
	readEstimateExpectedRunsFn,
	readEstimateScalarExpectedRunsFn,
	type EstimateExpectedRunsResult,
} from "~/estimate/fn/readEstimateExpectedRunsFn";
import { editorItemEstimateMaximumQuantity } from "~/estimate/schema/EditorItemEstimateQuantitySchema";
import type { EditorItemEstimateDiagnostic } from "~/estimate/type/EditorItemEstimate";
import type {
	EstimateSelectedRoute,
	EstimateWitness,
} from "~/estimate-witness/type/EstimateWitness";
import type {
	EditorAcquisitionQuantityProbability,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";

interface EstimateRequest {
	readonly factId: string;
	readonly quantity: number;
}

interface MaterializeEstimateWitnessesProps {
	readonly requests: ReadonlyArray<EstimateRequest>;
	readonly topology: EstimateTopology;
}

/**
 * One globally compatible witness is returned for every forced top route whose bounded search can
 * prove a complete selection. Bounded output algebra and witness search report partial diagnostics.
 */
export interface EstimateWitnessBatchEntry extends EstimateRequest {
	readonly candidates: ReadonlyArray<EstimateWitness>;
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
}

interface CandidateFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly status: "failure";
}

interface CandidateSuccess {
	readonly status: "success";
	readonly witness: EstimateWitness;
}

type CandidateResult = CandidateFailure | CandidateSuccess;

interface DemandSnapshot {
	readonly consumed: Map<string, number>;
	readonly dependencies: Map<string, Set<string>>;
	readonly oneTime: Map<string, number>;
	readonly ongoing: Map<string, number>;
	readonly required: Map<string, number>;
	readonly selected: Map<string, EstimateSelectedRoute>;
	readonly sharedOperationIds: ReadonlySet<string>;
}

interface EstimatePolicyState {
	readonly completeFactsByBlockedKey: Map<string, ReadonlySet<string>>;
	readonly quantityCostMemo: Map<string, number>;
	readonly scalarRunsByDistribution: Map<
		ReadonlyArray<EditorAcquisitionQuantityProbability>,
		Map<number, EstimateExpectedRunsResult>
	>;
	readonly topology: EstimateTopology;
	readonly unitCost: Map<string, number>;
}

interface WitnessChoicePoint {
	readonly key: string;
	readonly options: ReadonlyArray<string>;
	readonly selected: string;
}

interface WitnessChoiceContext {
	readonly choices: Map<string, WitnessChoicePoint>;
	readonly overrides: ReadonlyMap<string, string>;
}

interface CandidateAttempt {
	readonly choices: ReadonlyArray<WitnessChoicePoint>;
	readonly result: CandidateResult;
}

const epsilon = 1e-9;
const maximumWitnessSearchStates = 4_096;

const isPartialDiagnosticFn = (diagnostic: EditorItemEstimateDiagnostic) =>
	diagnostic.kind === "joint-output-accounting-unsupported" ||
	diagnostic.kind === "quantity-limit-exceeded" ||
	diagnostic.kind === "witness-search-exhausted";

const routeChoiceKeyFn = (factId: string) => `route\u0000${factId}`;

const requirementChoiceKeyFn = (routeId: string, clauseIndex: number) =>
	`requirement\u0000${routeId}\u0000${clauseIndex}`;

const recordChoiceFn = (
	context: WitnessChoiceContext | undefined,
	key: string,
	selected: string,
	options: ReadonlyArray<string>,
) => {
	if (
		context === undefined ||
		options.length === 0 ||
		(options.length === 1 && options[0] === selected)
	)
		return;
	context.choices.set(key, {
		key,
		options,
		selected,
	});
};

const addQuantityFn = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, (target.get(factId) ?? 0) + quantity);

const maximizeQuantityFn = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, Math.max(target.get(factId) ?? 0, quantity));

const equalQuantitiesFn = (left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>) =>
	left.size === right.size &&
	[
		...left,
	].every(([factId, quantity]) => Math.abs(quantity - (right.get(factId) ?? -1)) <= epsilon);

const readRequirementQuantityFn = (requirement: EditorAcquisitionRequirement, actionRuns: number) =>
	requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

const readRootQuantityFn = (topology: EstimateTopology, factId: string, quantity: number) => {
	const root = topology.roots.get(factId);
	return root === "unbounded" ? quantity : Math.min(root ?? 0, quantity);
};

const readMissingQuantityFn = (topology: EstimateTopology, factId: string, quantity: number) =>
	quantity - readRootQuantityFn(topology, factId, quantity);

const readScalarExpectedRunsFn = (
	state: EstimatePolicyState,
	distribution: ReadonlyArray<EditorAcquisitionQuantityProbability>,
	quantity: number,
) => {
	if (quantity > editorItemEstimateMaximumQuantity)
		return {
			status: "state-space-unsupported",
		} satisfies EstimateExpectedRunsResult;
	const cachedByQuantity = state.scalarRunsByDistribution.get(distribution);
	const cached = cachedByQuantity?.get(quantity);
	if (cached !== undefined) return cached;
	const result = readEstimateScalarExpectedRunsFn(distribution, quantity);
	const byQuantity = cachedByQuantity ?? new Map<number, EstimateExpectedRunsResult>();
	byQuantity.set(quantity, result);
	if (cachedByQuantity === undefined)
		state.scalarRunsByDistribution.set(distribution, byQuantity);
	return result;
};

const readCompleteFactsFn = (state: EstimatePolicyState, blockedFactIds: ReadonlySet<string>) => {
	const key = [
		...blockedFactIds,
	]
		.sort(Order.String)
		.join("\u0000");
	const cached = state.completeFactsByBlockedKey.get(key);
	if (cached !== undefined) return cached;
	const complete = new Set(state.topology.roots.keys());
	let pending = [
		...state.topology.routesByFact.values(),
	]
		.flatMap((routes) => routes)
		.filter(
			(route) =>
				!blockedFactIds.has(route.output.factId) &&
				!state.topology.unsupportedRoutes.has(route),
		);
	for (let iteration = 0; iteration < state.topology.factCount; iteration += 1) {
		let changed = false;
		const nextPending: EditorAcquisitionRoute[] = [];
		for (const route of pending) {
			const requirements = state.topology.requirementsByRoute.get(route);
			if (
				requirements === undefined ||
				requirements.allOf.some(({ factId }) => !complete.has(factId)) ||
				requirements.anyOf.some(
					(clause) => !clause.some(({ factId }) => complete.has(factId)),
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
	state.completeFactsByBlockedKey.set(key, complete);
	return complete;
};

const isCompleteRouteFn = (
	state: EstimatePolicyState,
	route: EditorAcquisitionRoute,
	blockedFactIds: ReadonlySet<string>,
) => {
	if (state.topology.unsupportedRoutes.has(route)) return false;
	const requirements = state.topology.requirementsByRoute.get(route);
	if (requirements === undefined) return false;
	const satisfiesFn = (complete: ReadonlySet<string>) =>
		requirements.allOf.every(({ factId }) => complete.has(factId)) &&
		requirements.anyOf.every((clause) => clause.some(({ factId }) => complete.has(factId)));
	const complete = readCompleteFactsFn(state, blockedFactIds);
	if (!satisfiesFn(complete)) return false;
	const outputComponent =
		state.topology.componentByFact.get(route.output.factId) ?? route.output.factId;
	const mayReenterOutputComponent =
		requirements.allOf.some(
			({ factId }) =>
				(state.topology.componentByFact.get(factId) ?? factId) === outputComponent,
		) ||
		requirements.anyOf.some((clause) =>
			clause
				.filter(({ factId }) => complete.has(factId))
				.every(
					({ factId }) =>
						(state.topology.componentByFact.get(factId) ?? factId) === outputComponent,
				),
		);
	return (
		!mayReenterOutputComponent ||
		satisfiesFn(
			readCompleteFactsFn(
				state,
				new Set([
					...blockedFactIds,
					route.output.factId,
				]),
			),
		)
	);
};

const chooseRequirementsFn = (
	state: EstimatePolicyState,
	route: EditorAcquisitionRoute,
	actionRuns: number,
	activeComponentId = state.topology.componentByFact.get(route.output.factId) ??
		route.output.factId,
	blockedFactIds: ReadonlySet<string> = new Set(),
	costMemo = state.quantityCostMemo,
	choiceContext?: WitnessChoiceContext,
) => {
	const routeRequirements = state.topology.requirementsByRoute.get(route);
	if (routeRequirements === undefined) return undefined;
	const requirements = [
		...routeRequirements.allOf,
	];
	for (const [clauseIndex, clause] of routeRequirements.anyOf.entries()) {
		const options = clause
			.map((requirement, index) => {
				const reentersIncompleteComponent =
					(state.topology.componentByFact.get(requirement.factId) ??
						requirement.factId) === activeComponentId &&
					!readCompleteFactsFn(
						state,
						new Set([
							...blockedFactIds,
							route.output.factId,
						]),
					).has(requirement.factId);
				return {
					cost: reentersIncompleteComponent
						? Number.POSITIVE_INFINITY
						: readFactCostFn(
								state,
								requirement.factId,
								readRequirementQuantityFn(requirement, actionRuns),
								activeComponentId,
								blockedFactIds,
								costMemo,
							),
					index,
					requirement,
				};
			})
			.filter(({ cost }) => Number.isFinite(cost))
			.sort(
				(left, right) =>
					left.cost - right.cost ||
					Order.String(left.requirement.factId, right.requirement.factId) ||
					left.index - right.index,
			);
		const key = requirementChoiceKeyFn(route.id, clauseIndex);
		const override = choiceContext?.overrides.get(key);
		const selected =
			override === undefined
				? options[0]
				: options.find(({ index }) => String(index) === override);
		const selectedValue = selected === undefined ? override : String(selected.index);
		if (selectedValue !== undefined)
			recordChoiceFn(
				choiceContext,
				key,
				selectedValue,
				options.map(({ index }) => String(index)),
			);
		if (selected === undefined) return undefined;
		requirements.push(selected.requirement);
	}
	return groupEstimateRequirementsFn(requirements, actionRuns);
};

const readRouteCostFn = (
	state: EstimatePolicyState,
	route: EditorAcquisitionRoute,
	quantity: number,
	activeComponentId = state.topology.componentByFact.get(route.output.factId) ??
		route.output.factId,
	blockedFactIds: ReadonlySet<string> = new Set(),
	costMemo = state.quantityCostMemo,
) => {
	if (!isCompleteRouteFn(state, route, blockedFactIds)) return Number.POSITIVE_INFINITY;
	const expected = readScalarExpectedRunsFn(state, route.output.quantityDistribution, quantity);
	if (expected.status === "state-space-unsupported" || !Number.isFinite(expected.runs))
		return Number.POSITIVE_INFINITY;
	const outputRuns = expected.runs;
	const actionRuns = outputRuns * route.runMultiplier;
	const groups = chooseRequirementsFn(
		state,
		route,
		actionRuns,
		activeComponentId,
		blockedFactIds,
		costMemo,
	);
	if (groups === undefined) return Number.POSITIVE_INFINITY;
	let dependencyCost = 0;
	for (const group of groups) {
		const groupCost = readFactCostFn(
			state,
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
};

function readFactCostFn(
	state: EstimatePolicyState,
	factId: string,
	quantity: number,
	activeComponentId: string,
	blockedFactIds: ReadonlySet<string>,
	costMemo: Map<string, number>,
): number {
	const missing = readMissingQuantityFn(state.topology, factId, quantity);
	if (missing <= epsilon) return 0;
	if (blockedFactIds.has(factId)) return Number.POSITIVE_INFINITY;
	const componentId = state.topology.componentByFact.get(factId) ?? factId;
	if (componentId === activeComponentId)
		return (state.unitCost.get(factId) ?? Number.POSITIVE_INFINITY) * missing;
	const normalized = Math.round(missing * 1e9) / 1e9;
	const blockedTop = blockedFactIds.values().next().value ?? "";
	const key = `${factId}\u0000${normalized}\u0000${activeComponentId}\u0000${blockedTop}`;
	const memoized = costMemo.get(key);
	if (memoized !== undefined) return memoized;
	const cost = Math.min(
		...(state.topology.routesByFact.get(factId) ?? [])
			.filter((route) => isCompleteRouteFn(state, route, blockedFactIds))
			.map((route) =>
				readRouteCostFn(state, route, missing, componentId, blockedFactIds, costMemo),
			),
	);
	costMemo.set(key, cost);
	return cost;
}

const readRouteOptionsFn = (state: EstimatePolicyState, factId: string, quantity: number) => {
	const missing = readMissingQuantityFn(state.topology, factId, quantity);
	return (state.topology.routesByFact.get(factId) ?? [])
		.map((route) => ({
			cost: readRouteCostFn(
				state,
				route,
				missing,
				state.topology.componentByFact.get(factId) ?? factId,
				new Set(),
				state.quantityCostMemo,
			),
			route,
		}))
		.filter(({ cost }) => Number.isFinite(cost))
		.sort(
			(left, right) => left.cost - right.cost || Order.String(left.route.id, right.route.id),
		)
		.map(({ route }) => route);
};

const createPolicyStateFn = (topology: EstimateTopology): EstimatePolicyState => {
	const state: EstimatePolicyState = {
		completeFactsByBlockedKey: new Map(),
		quantityCostMemo: new Map(),
		scalarRunsByDistribution: new Map(),
		topology,
		unitCost: new Map(),
	};
	for (const factId of topology.roots.keys()) state.unitCost.set(factId, 0);
	for (let iteration = 0; iteration < topology.factCount; iteration += 1) {
		let changed = false;
		for (const routes of topology.routesByFact.values())
			for (const route of routes) {
				if (topology.unsupportedRoutes.has(route)) continue;
				const expected = readScalarExpectedRunsFn(
					state,
					route.output.quantityDistribution,
					1,
				);
				if (
					expected.status === "state-space-unsupported" ||
					!Number.isFinite(expected.runs)
				)
					continue;
				const outputRuns = expected.runs;
				const actionRuns = outputRuns * route.runMultiplier;
				let dependencyCost = 0;
				const requirements = topology.requirementsByRoute.get(route);
				if (requirements === undefined) continue;
				for (const requirement of requirements.allOf) {
					const requirementCost = state.unitCost.get(requirement.factId);
					if (requirementCost === undefined) {
						dependencyCost = Number.POSITIVE_INFINITY;
						break;
					}
					dependencyCost = Math.max(
						dependencyCost,
						requirementCost * readRequirementQuantityFn(requirement, actionRuns),
					);
				}
				for (const clause of requirements.anyOf)
					dependencyCost = Math.max(
						dependencyCost,
						Math.min(
							...clause.map((requirement) => {
								const requirementCost = state.unitCost.get(requirement.factId);
								return requirementCost === undefined
									? Number.POSITIVE_INFINITY
									: requirementCost *
											readRequirementQuantityFn(requirement, actionRuns);
							}),
						),
					);
				const cost = route.durationMs * actionRuns + dependencyCost;
				const current = state.unitCost.get(route.output.factId);
				if (Number.isFinite(cost) && (current === undefined || cost < current - epsilon)) {
					state.unitCost.set(route.output.factId, cost);
					changed = true;
				}
			}
		if (!changed) break;
	}
	return state;
};

const shareOperationRunsFn = (
	state: EstimatePolicyState,
	factId: string,
	selected: ReadonlyMap<string, EstimateSelectedRoute>,
	topRouteId: string,
	choiceContext?: WitnessChoiceContext,
):
	| CandidateFailure
	| {
			readonly selected: Map<string, EstimateSelectedRoute>;
			readonly sharedOperationIds: ReadonlySet<string>;
			readonly status: "success";
	  } => {
	const result = new Map(selected);
	const selectedByOperationId = new Map<
		string,
		Array<
			readonly [
				string,
				EstimateSelectedRoute,
			]
		>
	>();
	for (const entry of selected) {
		const operationId = entry[1].route.operation?.id;
		if (operationId === undefined) continue;
		const entries = selectedByOperationId.get(operationId) ?? [];
		entries.push(entry);
		selectedByOperationId.set(operationId, entries);
	}
	const sharedOperationIds = new Set<string>();
	for (const entries of selectedByOperationId.values()) {
		if (entries.length < 2) continue;
		const operation = entries[0]?.[1].route.operation;
		if (operation?.outputDistribution === undefined) continue;
		const demandByOutputGroupId = new Map<string, number>();
		for (const [, plan] of entries) {
			const outputGroupId = plan.route.output.operationOutputGroupId;
			if (outputGroupId !== undefined)
				demandByOutputGroupId.set(outputGroupId, plan.producedQuantity);
		}
		if (demandByOutputGroupId.size < 2) continue;
		const expected = readEstimateExpectedRunsFn({
			demandByOutputGroupId,
			distribution: operation.outputDistribution,
		});
		if (expected.status === "state-space-unsupported")
			return {
				diagnostics: [
					{
						kind: "joint-output-accounting-unsupported",
						reason: "state-space",
						routeId: entries[0]?.[1].route.id ?? topRouteId,
					},
				],
				status: "failure",
			};
		if (!Number.isFinite(expected.runs))
			return {
				diagnostics: [
					{
						factId: entries[0]?.[0] ?? factId,
						kind: "zero-yield",
						routeId: entries[0]?.[1].route.id ?? topRouteId,
					},
				],
				status: "failure",
			};
		const actionRuns =
			expected.runs * Math.max(...entries.map(([, plan]) => plan.route.runMultiplier));
		sharedOperationIds.add(operation.id);
		const groupsByFactId = new Map<string, EstimateSelectedRoute["groups"][number]>();
		for (const [, plan] of entries) {
			const groups = chooseRequirementsFn(
				state,
				plan.route,
				actionRuns,
				undefined,
				undefined,
				undefined,
				choiceContext,
			);
			if (groups === undefined) continue;
			for (const group of groups) {
				const current = groupsByFactId.get(group.factId);
				groupsByFactId.set(group.factId, {
					...group,
					consumed: Math.max(current?.consumed ?? 0, group.consumed),
					distinctOneTime: Math.max(current?.distinctOneTime ?? 0, group.distinctOneTime),
					oneTime: Math.max(current?.oneTime ?? 0, group.oneTime),
					ongoing: Math.max(current?.ongoing ?? 0, group.ongoing),
					sources: [
						...new Set([
							...(current?.sources ?? []),
							...group.sources,
						]),
					].sort(),
				});
			}
		}
		const groups = [
			...groupsByFactId.values(),
		].sort((left, right) => Order.String(left.factId, right.factId));
		for (const [id, plan] of entries)
			result.set(id, {
				...plan,
				actionRuns,
				groups,
				outputRuns: expected.runs,
			});
	}
	return {
		selected: result,
		sharedOperationIds,
		status: "success",
	};
};

const findCycleFn = (dependencies: ReadonlyMap<string, ReadonlySet<string>>) => {
	const cycles: ReadonlyArray<string>[] = [];
	for (const factId of [
		...dependencies.keys(),
	].sort(Order.String)) {
		const pending: ReadonlyArray<string>[] = [
			[
				factId,
			],
		];
		const visited = new Set([
			factId,
		]);
		while (pending.length > 0) {
			const path = pending.shift();
			const current = path?.at(-1);
			if (path === undefined || current === undefined) continue;
			for (const dependencyId of [
				...(dependencies.get(current) ?? []),
			].sort(Order.String)) {
				if (dependencyId === factId) {
					cycles.push([
						...path,
						factId,
					]);
					pending.length = 0;
					break;
				}
				if (!visited.has(dependencyId)) {
					visited.add(dependencyId);
					pending.push([
						...path,
						dependencyId,
					]);
				}
			}
		}
	}
	return cycles.sort(
		(left, right) =>
			left.length - right.length || Order.String(left.join("\u0000"), right.join("\u0000")),
	)[0];
};

const materializeCandidateSelectionFn = (
	state: EstimatePolicyState,
	factId: string,
	quantity: number,
	topRoute: EditorAcquisitionRoute,
	choiceContext: WitnessChoiceContext,
): CandidateResult => {
	let required = new Map([
		[
			factId,
			quantity,
		],
	]);
	let snapshot: DemandSnapshot | undefined;
	const maximumIterations = Math.max(2, state.topology.factCount * 2);

	for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
		let selected = new Map<string, EstimateSelectedRoute>();
		for (const [id, requiredQuantity] of [
			...required,
		].sort(([left], [right]) => Order.String(left, right))) {
			if (requiredQuantity > editorItemEstimateMaximumQuantity)
				return {
					diagnostics: [
						{
							factId: id,
							kind: "quantity-limit-exceeded",
							maximumQuantity: editorItemEstimateMaximumQuantity,
							quantity: requiredQuantity,
							source: "authored-demand",
						},
					],
					status: "failure",
				};
			const rootQuantity = readRootQuantityFn(state.topology, id, requiredQuantity);
			const missing = Math.max(0, requiredQuantity - rootQuantity);
			if (missing <= epsilon) continue;
			const routes = state.topology.routesByFact.get(id) ?? [];
			const routeOptions = readRouteOptionsFn(state, id, requiredQuantity);
			const routeChoiceKey = routeChoiceKeyFn(id);
			const routeOverride = choiceContext.overrides.get(routeChoiceKey);
			const route =
				id === factId
					? topRoute
					: routeOverride === undefined
						? (routeOptions[0] ?? routes[0])
						: routeOptions.find(({ id: routeId }) => routeId === routeOverride);
			if (id !== factId && routeOverride !== undefined && route === undefined)
				recordChoiceFn(
					choiceContext,
					routeChoiceKey,
					routeOverride,
					routeOptions.map(({ id: routeId }) => routeId),
				);
			if (route === undefined)
				return {
					diagnostics: [
						{
							factId: id,
							kind: "unreachable",
							quantity: missing,
							routeId: topRoute.id,
						},
					],
					status: "failure",
				};
			if (id !== factId && routeOptions.includes(route))
				recordChoiceFn(
					choiceContext,
					routeChoiceKey,
					route.id,
					routeOptions.map(({ id: routeId }) => routeId),
				);
			if (state.topology.unsupportedRoutes.has(route))
				return {
					diagnostics: [
						{
							kind: "joint-output-accounting-unsupported",
							reason: "state-space",
							routeId: route.id,
						},
					],
					status: "failure",
				};
			const expected = readScalarExpectedRunsFn(
				state,
				route.output.quantityDistribution,
				missing,
			);
			if (expected.status === "state-space-unsupported")
				return {
					diagnostics: [
						{
							kind: "joint-output-accounting-unsupported",
							reason: "state-space",
							routeId: route.id,
						},
					],
					status: "failure",
				};
			const outputRuns = expected.runs;
			if (!Number.isFinite(outputRuns))
				return {
					diagnostics: [
						{
							factId: id,
							kind: "zero-yield",
							routeId: route.id,
						},
					],
					status: "failure",
				};
			const actionRuns = outputRuns * route.runMultiplier;
			const groups = chooseRequirementsFn(
				state,
				route,
				actionRuns,
				undefined,
				undefined,
				undefined,
				choiceContext,
			);
			if (groups === undefined)
				return {
					diagnostics: [
						{
							factId: id,
							kind: "unreachable",
							quantity: missing,
							routeId: route.id,
						},
					],
					status: "failure",
				};
			selected.set(id, {
				actionRuns,
				groups,
				outputRuns,
				producedQuantity: missing,
				recurrenceFactIds: new Set(),
				route,
			});
		}

		const shared = shareOperationRunsFn(state, factId, selected, topRoute.id, choiceContext);
		if (shared.status === "failure") return shared;
		selected = shared.selected;

		const consumed = new Map<string, number>();
		const concurrent = new Map<string, number>();
		const oneTime = new Map<string, number>();
		const ongoing = new Map<string, number>();
		const accountedOperationIds = new Set<string>();
		for (const plan of selected.values()) {
			const operationId = plan.route.operation?.id;
			if (operationId !== undefined && accountedOperationIds.has(operationId)) continue;
			if (operationId !== undefined && shared.sharedOperationIds.has(operationId))
				accountedOperationIds.add(operationId);
			for (const group of plan.groups) {
				addQuantityFn(consumed, group.factId, group.consumed);
				maximizeQuantityFn(
					concurrent,
					group.factId,
					group.consumed + Math.max(group.oneTime, group.ongoing),
				);
				maximizeQuantityFn(oneTime, group.factId, group.oneTime);
				maximizeQuantityFn(ongoing, group.factId, group.ongoing);
			}
		}
		const nextRequired = new Map<string, number>([
			[
				factId,
				quantity,
			],
		]);
		for (const id of new Set([
			...consumed.keys(),
			...concurrent.keys(),
		])) {
			nextRequired.set(
				id,
				Math.max(
					(nextRequired.get(id) ?? 0) + (consumed.get(id) ?? 0),
					concurrent.get(id) ?? 0,
				),
			);
		}

		const dependencies = new Map<string, Set<string>>();
		const selectedWithRecurrence = new Map<string, EstimateSelectedRoute>();
		for (const [id, plan] of selected) {
			const seededComponent = state.topology.seededComponentByFact.get(id);
			const recurrenceFactIds = new Set<string>();
			for (const group of plan.groups) {
				const root = state.topology.roots.get(group.factId);
				const groupSeededComponent = state.topology.seededComponentByFact.get(group.factId);
				if (
					group.consumed <= epsilon &&
					(root === "unbounded" ||
						(root ?? 0) >= Math.max(group.oneTime, group.ongoing)) &&
					seededComponent !== undefined &&
					seededComponent === groupSeededComponent
				)
					recurrenceFactIds.add(group.factId);
			}
			dependencies.set(
				id,
				new Set(
					plan.groups
						.map((group) => group.factId)
						.filter((dependencyId) => !recurrenceFactIds.has(dependencyId)),
				),
			);
			selectedWithRecurrence.set(id, {
				...plan,
				recurrenceFactIds,
			});
		}
		const cycle = findCycleFn(dependencies);
		if (cycle !== undefined)
			return {
				diagnostics: [
					{
						factIds: cycle,
						kind: "cycle",
						routeId: topRoute.id,
					},
				],
				status: "failure",
			};
		snapshot = {
			consumed,
			dependencies,
			oneTime,
			ongoing,
			required: nextRequired,
			selected: selectedWithRecurrence,
			sharedOperationIds: shared.sharedOperationIds,
		};
		if (equalQuantitiesFn(required, nextRequired)) break;
		required = nextRequired;
	}

	if (snapshot === undefined || !equalQuantitiesFn(required, snapshot.required))
		return {
			diagnostics: [
				{
					factId,
					kind: "unreachable",
					quantity,
					routeId: topRoute.id,
				},
			],
			status: "failure",
		};
	return {
		status: "success",
		witness: {
			consumedByFact: snapshot.consumed,
			dependenciesByFact: snapshot.dependencies,
			factId,
			oneTimeByFact: snapshot.oneTime,
			ongoingByFact: snapshot.ongoing,
			quantity,
			requiredQuantityByFact: snapshot.required,
			selectedByFact: snapshot.selected,
			sharedOperationIds: snapshot.sharedOperationIds,
			topRouteId: topRoute.id,
		},
	};
};

const readChoiceSignatureFn = (overrides: ReadonlyMap<string, string>) =>
	JSON.stringify(
		[
			...overrides,
		].sort(([left], [right]) => Order.String(left, right)),
	);

const readWitnessRouteIdentityFn = (witness: EstimateWitness) =>
	JSON.stringify(
		[
			...witness.selectedByFact,
		]
			.sort(([left], [right]) => Order.String(left, right))
			.map(([selectedFactId, selected]) => [
				selectedFactId,
				selected.route.id,
			]),
	);

const compareWitnessesFn = (left: EstimateWitness, right: EstimateWitness) =>
	projectEstimateWitnessFn(left).durationMs - projectEstimateWitnessFn(right).durationMs ||
	Order.String(readWitnessRouteIdentityFn(left), readWitnessRouteIdentityFn(right));

const materializeCandidateAttemptFn = (
	state: EstimatePolicyState,
	factId: string,
	quantity: number,
	topRoute: EditorAcquisitionRoute,
	overrides: ReadonlyMap<string, string>,
): CandidateAttempt => {
	const choices = new Map<string, WitnessChoicePoint>();
	const result = materializeCandidateSelectionFn(state, factId, quantity, topRoute, {
		choices,
		overrides,
	});
	return {
		choices: [
			...choices.values(),
		],
		result,
	};
};

const materializeCandidateFn = (
	state: EstimatePolicyState,
	factId: string,
	quantity: number,
	topRoute: EditorAcquisitionRoute,
): CandidateResult => {
	const baseline = materializeCandidateAttemptFn(state, factId, quantity, topRoute, new Map());

	const pending: Array<ReadonlyMap<string, string>> = [];
	const seen = new Set<string>();
	let attemptedStates = 1;
	let best = baseline.result.status === "success" ? baseline.result.witness : undefined;
	const partialDiagnostics: EditorItemEstimateDiagnostic[] =
		baseline.result.status === "failure"
			? baseline.result.diagnostics.filter(isPartialDiagnosticFn)
			: [];

	const enqueueAlternativesFn = (choices: ReadonlyArray<WitnessChoicePoint>) => {
		const active = new Map(
			choices.map(({ key, selected }) => [
				key,
				selected,
			]),
		);
		seen.add(readChoiceSignatureFn(active));
		for (const choice of [
			...choices,
		].sort((left, right) => Order.String(left.key, right.key)))
			for (const option of choice.options) {
				if (option === choice.selected) continue;
				const alternative = new Map(active);
				alternative.set(choice.key, option);
				const signature = readChoiceSignatureFn(alternative);
				if (seen.has(signature)) continue;
				seen.add(signature);
				pending.push(alternative);
			}
	};

	enqueueAlternativesFn(baseline.choices);
	while (pending.length > 0) {
		if (attemptedStates >= maximumWitnessSearchStates)
			return {
				diagnostics: [
					{
						kind: "witness-search-exhausted",
						maximumStates: maximumWitnessSearchStates,
						routeId: topRoute.id,
					},
				],
				status: "failure",
			};
		const overrides = pending.shift();
		if (overrides === undefined) break;
		const attempt = materializeCandidateAttemptFn(state, factId, quantity, topRoute, overrides);
		attemptedStates += 1;
		if (
			attempt.result.status === "success" &&
			(best === undefined || compareWitnessesFn(attempt.result.witness, best) < 0)
		)
			best = attempt.result.witness;
		else if (attempt.result.status === "failure")
			partialDiagnostics.push(...attempt.result.diagnostics.filter(isPartialDiagnosticFn));
		enqueueAlternativesFn(attempt.choices);
	}

	return best === undefined
		? partialDiagnostics.length === 0
			? baseline.result
			: {
					diagnostics: partialDiagnostics,
					status: "failure",
				}
		: {
				status: "success",
				witness: best,
			};
};

const makeRootWitnessFn = (request: EstimateRequest): EstimateWitness => ({
	consumedByFact: new Map(),
	dependenciesByFact: new Map(),
	factId: request.factId,
	oneTimeByFact: new Map(),
	ongoingByFact: new Map(),
	quantity: request.quantity,
	requiredQuantityByFact: new Map([
		[
			request.factId,
			request.quantity,
		],
	]),
	selectedByFact: new Map(),
	sharedOperationIds: new Set(),
	topRouteId: `root:${request.factId}`,
});

const materializeRequestFn = (
	state: EstimatePolicyState,
	request: EstimateRequest,
): EstimateWitnessBatchEntry => {
	if (request.quantity > editorItemEstimateMaximumQuantity)
		return {
			...request,
			candidates: [],
			diagnostics: [
				{
					factId: request.factId,
					kind: "quantity-limit-exceeded",
					maximumQuantity: editorItemEstimateMaximumQuantity,
					quantity: request.quantity,
					source: "request",
				},
			],
		};
	if (!(request.quantity > 0) || !state.topology.factIds.has(request.factId))
		return {
			...request,
			candidates: [],
			diagnostics: [
				{
					factId: request.factId,
					kind: "unreachable",
					quantity: request.quantity,
				},
			],
		};
	if (readMissingQuantityFn(state.topology, request.factId, request.quantity) <= epsilon)
		return {
			...request,
			candidates: [
				makeRootWitnessFn(request),
			],
			diagnostics: [],
		};

	const candidates: EstimateWitness[] = [];
	const diagnostics: EditorItemEstimateDiagnostic[] = [];
	for (const topRoute of state.topology.routesByFact.get(request.factId) ?? []) {
		const result = materializeCandidateFn(state, request.factId, request.quantity, topRoute);
		if (result.status === "success") candidates.push(result.witness);
		else diagnostics.push(...result.diagnostics);
	}
	return {
		...request,
		candidates,
		diagnostics,
	};
};

/** Materializes an entire Estimate request batch with call-local topology and quantity caches. */
export const materializeEstimateWitnessesFn = ({
	requests,
	topology,
}: MaterializeEstimateWitnessesProps): ReadonlyArray<EstimateWitnessBatchEntry> => {
	const state = createPolicyStateFn(topology);
	return requests.map((request) => materializeRequestFn(state, request));
};
