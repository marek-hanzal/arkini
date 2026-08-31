import { Order } from "effect";

import { projectEstimateWitnessFn } from "~/estimate/fn/projectEstimateWitnessFn";
import {
	createEstimateRoutePolicyFn,
	readEstimateRouteOptionsFn,
	readEstimateRouteRequirementsFn,
} from "~/estimate/fn/createEstimateRoutePolicyFn";
import type { EstimateTopology } from "~/estimate/fn/createEstimateTopologyFn";
import { readEstimateMissingQuantityFn } from "~/estimate/fn/readEstimateMissingQuantityFn";
import {
	readEstimateScalarExpectedRunsFn,
	type EstimateExpectedRunsResult,
} from "~/estimate/fn/readEstimateExpectedRunsFn";
import { shareEstimateOperationRunsFn } from "~/estimate/fn/shareEstimateOperationRunsFn";
import { itemEstimateMaximumQuantity } from "~/estimate/schema/ItemEstimateQuantitySchema";
import type { ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import type { EstimateSelectedRoute, EstimateWitness } from "~/estimate/type/EstimateWitness";
import type {
	AcquisitionQuantityProbability,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";

interface EstimateRequest {
	readonly factId: string;
	readonly quantity: number;
}

interface MaterializeEstimateWitnessesProps {
	readonly requests: ReadonlyArray<EstimateRequest>;
	readonly topology: EstimateTopology;
}

interface EstimateWitnessBatchEntry extends EstimateRequest {
	readonly candidates: ReadonlyArray<EstimateWitness>;
	readonly diagnostics: ReadonlyArray<ItemEstimateDiagnostic>;
}

interface CandidateFailure {
	readonly diagnostics: ReadonlyArray<ItemEstimateDiagnostic>;
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

type EstimateRoutePolicy = ReturnType<typeof createEstimateRoutePolicyFn>;

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

const isPartialDiagnosticFn = (diagnostic: ItemEstimateDiagnostic) =>
	diagnostic.kind === "joint-output-accounting-unsupported" ||
	diagnostic.kind === "quantity-limit-exceeded" ||
	diagnostic.kind === "witness-search-exhausted";

const routeChoiceKeyFn = (factId: string) => `route\u0000${factId}`;

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

const readScalarExpectedRunsFn = (
	distribution: ReadonlyArray<AcquisitionQuantityProbability>,
	quantity: number,
): EstimateExpectedRunsResult =>
	quantity > itemEstimateMaximumQuantity
		? {
				status: "state-space-unsupported",
			}
		: readEstimateScalarExpectedRunsFn(distribution, quantity);

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
	policy: EstimateRoutePolicy,
	factId: string,
	quantity: number,
	topRoute: AcquisitionRoute,
	choiceContext: WitnessChoiceContext,
): CandidateResult => {
	let required = new Map([
		[
			factId,
			quantity,
		],
	]);
	let snapshot: DemandSnapshot | undefined;
	const maximumIterations = Math.max(2, policy.topology.factCount * 2);

	for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
		let selected = new Map<string, EstimateSelectedRoute>();
		for (const [id, requiredQuantity] of [
			...required,
		].sort(([left], [right]) => Order.String(left, right))) {
			if (requiredQuantity > itemEstimateMaximumQuantity)
				return {
					diagnostics: [
						{
							factId: id,
							kind: "quantity-limit-exceeded",
							maximumQuantity: itemEstimateMaximumQuantity,
							quantity: requiredQuantity,
							source: "authored-demand",
						},
					],
					status: "failure",
				};
			const missing = Math.max(
				0,
				readEstimateMissingQuantityFn(policy.topology, id, requiredQuantity),
			);
			if (missing <= epsilon) continue;
			const routes = policy.topology.routesByFact.get(id) ?? [];
			const routeOptions = readEstimateRouteOptionsFn(policy, id, requiredQuantity);
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
			if (policy.topology.unsupportedRoutes.has(route))
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
			const expected = readScalarExpectedRunsFn(route.output.quantityDistribution, missing);
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
			const requirementSelection = readEstimateRouteRequirementsFn(
				policy,
				route,
				actionRuns,
				choiceContext.overrides,
			);
			if (requirementSelection === undefined)
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
			for (const choice of requirementSelection.choices)
				recordChoiceFn(choiceContext, choice.key, choice.selected, choice.options);
			selected.set(id, {
				actionRuns,
				groups: requirementSelection.groups,
				outputRuns,
				producedQuantity: missing,
				recurrenceFactIds: new Set(),
				route,
			});
		}

		const shared = shareEstimateOperationRunsFn({
			choiceOverrides: choiceContext.overrides,
			factId,
			policy,
			selected,
			topRouteId: topRoute.id,
		});
		if (shared.status === "failure") return shared;
		for (const choice of shared.choices)
			recordChoiceFn(choiceContext, choice.key, choice.selected, choice.options);
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
					Math.max(
						(nextRequired.get(id) ?? 0) + (consumed.get(id) ?? 0),
						concurrent.get(id) ?? 0,
					),
				),
			);
		}

		const dependencies = new Map<string, Set<string>>();
		const selectedWithRecurrence = new Map<string, EstimateSelectedRoute>();
		for (const [id, plan] of selected) {
			const seededComponent = policy.topology.seededComponentByFact.get(id);
			const recurrenceFactIds = new Set<string>();
			for (const group of plan.groups) {
				const root = policy.topology.roots.get(group.factId);
				const groupSeededComponent = policy.topology.seededComponentByFact.get(
					group.factId,
				);
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
	policy: EstimateRoutePolicy,
	factId: string,
	quantity: number,
	topRoute: AcquisitionRoute,
	overrides: ReadonlyMap<string, string>,
): CandidateAttempt => {
	const choices = new Map<string, WitnessChoicePoint>();
	const result = materializeCandidateSelectionFn(policy, factId, quantity, topRoute, {
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
	policy: EstimateRoutePolicy,
	factId: string,
	quantity: number,
	topRoute: AcquisitionRoute,
): CandidateResult => {
	const baseline = materializeCandidateAttemptFn(policy, factId, quantity, topRoute, new Map());
	const pending: Array<ReadonlyMap<string, string>> = [];
	const seen = new Set<string>();
	let attemptedStates = 1;
	let best = baseline.result.status === "success" ? baseline.result.witness : undefined;
	const partialDiagnostics: ItemEstimateDiagnostic[] =
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
		const attempt = materializeCandidateAttemptFn(
			policy,
			factId,
			quantity,
			topRoute,
			overrides,
		);
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
	policy: EstimateRoutePolicy,
	request: EstimateRequest,
): EstimateWitnessBatchEntry => {
	if (request.quantity > itemEstimateMaximumQuantity)
		return {
			...request,
			candidates: [],
			diagnostics: [
				{
					factId: request.factId,
					kind: "quantity-limit-exceeded",
					maximumQuantity: itemEstimateMaximumQuantity,
					quantity: request.quantity,
					source: "request",
				},
			],
		};
	if (!(request.quantity > 0) || !policy.topology.factIds.has(request.factId))
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
	if (readEstimateMissingQuantityFn(policy.topology, request.factId, request.quantity) <= epsilon)
		return {
			...request,
			candidates: [
				makeRootWitnessFn(request),
			],
			diagnostics: [],
		};

	const candidates: EstimateWitness[] = [];
	const diagnostics: ItemEstimateDiagnostic[] = [];
	for (const topRoute of policy.topology.routesByFact.get(request.factId) ?? []) {
		const result = materializeCandidateFn(policy, request.factId, request.quantity, topRoute);
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
	const policy = createEstimateRoutePolicyFn(topology);
	return requests.map((request) => materializeRequestFn(policy, request));
};
