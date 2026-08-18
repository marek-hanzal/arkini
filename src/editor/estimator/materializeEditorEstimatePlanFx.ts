import { Effect } from "effect";

import type { EditorAcquisitionRoute } from "~/editor/EditorAcquisitionGraph";
import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type { EditorItemEstimateDiagnostic } from "~/editor/estimator/EditorItemEstimate";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";
import type {
	EditorEstimateRouteProjection,
	EditorEstimateSelectedRoute,
} from "~/editor/estimator/projectEditorEstimateRouteStepFx";
import { projectEditorEstimateRouteStepFx } from "~/editor/estimator/projectEditorEstimateRouteStepFx";
import { readEditorEstimateParallelDurationFx } from "~/editor/estimator/readEditorEstimateParallelDurationFx";
import { shareEditorEstimateOperationRunsFx } from "~/editor/estimator/shareEditorEstimateOperationRunsFx";

export interface EditorEstimateCandidatePlan {
	readonly durationMs: number;
	readonly projection: EditorEstimateRouteProjection;
}

interface EditorEstimateCandidateFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
}

interface DemandSnapshot {
	readonly dependencies: Map<string, Set<string>>;
	readonly required: Map<string, number>;
	readonly selected: Map<string, EditorEstimateSelectedRoute>;
	readonly sharedOperationIds: ReadonlySet<string>;
}

const add = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, (target.get(factId) ?? 0) + quantity);
const maximize = (target: Map<string, number>, factId: string, quantity: number) =>
	target.set(factId, Math.max(target.get(factId) ?? 0, quantity));

const equalQuantities = (left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>) =>
	left.size === right.size &&
	[
		...left,
	].every(([factId, quantity]) => Math.abs(quantity - (right.get(factId) ?? -1)) <= 1e-9);

const findCycle = (dependencies: ReadonlyMap<string, ReadonlySet<string>>) => {
	const cycles: ReadonlyArray<string>[] = [];
	for (const factId of [
		...dependencies.keys(),
	].sort()) {
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
			].sort()) {
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
			left.length - right.length || left.join("\u0000").localeCompare(right.join("\u0000")),
	)[0];
};

const cycleDiagnostic = (
	cycle: ReadonlyArray<string>,
	topRouteId: string,
): EditorItemEstimateDiagnostic => ({
	factIds: cycle,
	kind: "cycle",
	routeId: topRouteId,
});

/** Materializes one forced top route through a bounded, deterministic demand fixed point. */
export const materializeEditorEstimatePlanFx = Effect.fn("materializeEditorEstimatePlanFx")(
	({
		factId,
		policy,
		quantity,
		topRoute,
	}: {
		readonly factId: string;
		readonly policy: EditorEstimatePolicy;
		readonly quantity: number;
		readonly topRoute: EditorAcquisitionRoute;
	}) =>
		Effect.gen(function* () {
			let required = new Map([
				[
					factId,
					quantity,
				],
			]);
			let snapshot: DemandSnapshot | undefined;
			const maximumIterations = Math.max(2, policy.factCount * 2);

			for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
				let selected = new Map<string, EditorEstimateSelectedRoute>();
				for (const [id, requiredQuantity] of [
					...required,
				].sort(([left], [right]) => left.localeCompare(right))) {
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
						} satisfies EditorEstimateCandidateFailure;
					const root = yield* policy.readRootQuantityFx(id);
					const rootQuantity =
						root === "unbounded"
							? requiredQuantity
							: Math.min(root ?? 0, requiredQuantity);
					const missing = Math.max(0, requiredQuantity - rootQuantity);
					if (missing <= 1e-9) continue;
					const routes = yield* policy.readCandidateRoutesFx(id);
					const route =
						id === factId
							? topRoute
							: ((yield* policy.chooseRouteFx(id, requiredQuantity)) ?? routes[0]);
					if (route === undefined)
						return {
							diagnostics: [
								{
									factId: id,
									kind: "unreachable",
									quantity: missing,
								},
							],
						} satisfies EditorEstimateCandidateFailure;
					if (route.operation?.outputCompilation === "state-space-unsupported")
						return {
							diagnostics: [
								{
									kind: "joint-output-accounting-unsupported",
									reason: "state-space",
									routeId: route.id,
								},
							],
						} satisfies EditorEstimateCandidateFailure;
					const outputDistribution = route.output.quantityDistribution;
					const outputRuns = yield* policy.readExpectedRunsFx(
						outputDistribution,
						missing,
					);
					if (!Number.isFinite(outputRuns))
						return {
							diagnostics: [
								{
									factId: id,
									kind: "zero-yield",
									routeId: route.id,
								},
							],
						} satisfies EditorEstimateCandidateFailure;
					const actionRuns = outputRuns * route.runMultiplier;
					const groups = yield* policy.chooseRequirementsFx(route, actionRuns);
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
						} satisfies EditorEstimateCandidateFailure;
					selected.set(id, {
						actionRuns,
						groups,
						outputRuns,
						producedQuantity: missing,
						recurrenceFactIds: new Set(),
						route,
					});
				}

				const shared = yield* shareEditorEstimateOperationRunsFx({
					factId,
					policy,
					selected,
					topRouteId: topRoute.id,
				});
				if (shared.status === "failure")
					return {
						diagnostics: shared.diagnostics,
					} satisfies EditorEstimateCandidateFailure;
				const { sharedOperationIds } = shared;
				selected = shared.selected;

				const consumables = new Map<string, number>();
				const concurrent = new Map<string, number>();
				const accountedOperationIds = new Set<string>();
				for (const plan of selected.values()) {
					const operationId = plan.route.operation?.id;
					if (operationId !== undefined && accountedOperationIds.has(operationId))
						continue;
					if (operationId !== undefined && sharedOperationIds.has(operationId))
						accountedOperationIds.add(operationId);
					for (const group of plan.groups) {
						add(consumables, group.factId, group.consumed);
						maximize(
							concurrent,
							group.factId,
							group.consumed + Math.max(group.oneTime, group.ongoing),
						);
					}
				}
				const nextRequired = new Map<string, number>([
					[
						factId,
						quantity,
					],
				]);
				for (const id of new Set([
					...consumables.keys(),
					...concurrent.keys(),
				])) {
					nextRequired.set(
						id,
						Math.max(
							(nextRequired.get(id) ?? 0) + (consumables.get(id) ?? 0),
							concurrent.get(id) ?? 0,
						),
					);
				}
				const recurrenceByFact = new Map<string, Set<string>>();
				const dependencies = new Map<string, Set<string>>();
				for (const [id, plan] of selected) {
					const seededComponent = yield* policy.readSeededComponentFx(id);
					const recurrenceFactIds = new Set<string>();
					for (const group of plan.groups) {
						const root = yield* policy.readRootQuantityFx(group.factId);
						const groupSeededComponent = yield* policy.readSeededComponentFx(
							group.factId,
						);
						if (
							group.consumed <= 1e-9 &&
							(root === "unbounded" ||
								(root ?? 0) >= Math.max(group.oneTime, group.ongoing)) &&
							seededComponent !== undefined &&
							seededComponent === groupSeededComponent
						)
							recurrenceFactIds.add(group.factId);
					}
					recurrenceByFact.set(id, recurrenceFactIds);
					dependencies.set(
						id,
						new Set(
							plan.groups
								.map((group) => group.factId)
								.filter((dependencyId) => !recurrenceFactIds.has(dependencyId)),
						),
					);
				}
				const selectedWithRecurrence = new Map(
					[
						...selected,
					].map(
						([id, plan]) =>
							[
								id,
								{
									...plan,
									recurrenceFactIds:
										recurrenceByFact.get(id) ?? new Set<string>(),
								},
							] as const,
					),
				);
				const cycle = findCycle(dependencies);
				if (cycle !== undefined)
					return {
						diagnostics: [
							cycleDiagnostic(cycle, topRoute.id),
						],
					} satisfies EditorEstimateCandidateFailure;
				snapshot = {
					dependencies,
					required: nextRequired,
					selected: selectedWithRecurrence,
					sharedOperationIds,
				};
				if (equalQuantities(required, nextRequired)) break;
				required = nextRequired;
			}

			if (snapshot === undefined || !equalQuantities(required, snapshot.required))
				return {
					diagnostics: [
						{
							factId,
							kind: "unreachable",
							quantity,
							routeId: topRoute.id,
						},
					],
				} satisfies EditorEstimateCandidateFailure;
			const projection = yield* projectEditorEstimateRouteStepFx({
				dependencies: snapshot.dependencies,
				factId,
				requiredQuantityByFact: snapshot.required,
				selected: snapshot.selected,
				topRouteId: topRoute.id,
			});
			if ("diagnostics" in projection) return projection;
			const durationMs = yield* readEditorEstimateParallelDurationFx({
				dependencies: snapshot.dependencies,
				factId,
				selected: snapshot.selected,
				sharedOperationIds: snapshot.sharedOperationIds,
			});
			return {
				durationMs,
				projection,
			};
		}),
);
