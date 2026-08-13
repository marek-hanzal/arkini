import { Effect } from "effect";

import {
	DefaultPlannerSearchBudget,
	type PlannerSearchBudget,
	type PlannerSearchBudgetLimit,
	type PlannerSearchDiagnostics,
	type PlannerSearchOutputCertainty,
	type PlannerSearchResult,
	type PlannerSearchRoutePlanDiagnostic,
	type PlannerSearchTraceEntry,
} from "~/editor/planner/PlannerSearch";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import { createPlannerRuntimeDominanceIndex } from "~/editor/planner/createPlannerRuntimeDominanceIndex";
import { isPlannerRuntimeQuiescent } from "~/editor/planner/isPlannerRuntimeQuiescent";
import { readPlannerActionChargeFlowFx } from "~/editor/planner/readPlannerActionChargeFlowFx";
import { readPlannerActionItemFlowFx } from "~/editor/planner/readPlannerActionItemFlowFx";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import { readPlannerSearchCandidateGroups } from "~/editor/planner/readPlannerSearchCandidateGroups";
import {
	comparePlannerSearchPriority,
	readPlannerSearchPriority,
	readPlannerSearchPriorityPlan,
	type PlannerSearchPriority,
} from "~/editor/planner/readPlannerSearchPriority";
import {
	iteratePlannerSearchScopes,
	readPlannerSearchScope,
} from "~/editor/planner/readPlannerSearchScope";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { runPlannerActionFx } from "~/editor/planner/runPlannerActionFx";
import type { PlannerAcquisitionGraph } from "~/editor/planner/PlannerAcquisitionGraph";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace searchPlannerRuntimeFx {
	export interface Props {
		readonly budget?: Partial<PlannerSearchBudget>;
		readonly graph: PlannerAcquisitionGraph;
		readonly itemId: IdSchema.Type;
		readonly quantity?: number;
		readonly runtime: RuntimeSchema.Type;
	}
}

interface SearchNode {
	readonly elapsedMs: number;
	readonly fingerprint: string;
	readonly order: number;
	readonly outputCertainty: PlannerSearchOutputCertainty;
	readonly priority: PlannerSearchPriority;
	readonly runtime: RuntimeSchema.Type;
	readonly selectedWitnessProbability: number;
	readonly stateToken: number;
	readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const EmptyPlannerSearchDiagnostics: PlannerSearchDiagnostics = {
	attemptedRoutePlans: 0,
	routePlans: [],
};

const readPlannerSearchDiagnostics = (
	routePlans: ReadonlyArray<PlannerSearchRoutePlanDiagnostic>,
	winningRoutePlanIndex?: number,
): PlannerSearchDiagnostics => ({
	attemptedRoutePlans: routePlans.length,
	routePlans,
	...(winningRoutePlanIndex === undefined
		? {}
		: {
				winningRoutePlanIndex,
			}),
});

const readPositiveBudget = (candidate: number | undefined, fallback: number) =>
	candidate === undefined || !Number.isFinite(candidate)
		? fallback
		: Math.max(1, Math.floor(candidate));

const readBudget = (budget: Partial<PlannerSearchBudget> | undefined): PlannerSearchBudget => ({
	maximumExpandedStates: readPositiveBudget(
		budget?.maximumExpandedStates,
		DefaultPlannerSearchBudget.maximumExpandedStates,
	),
	maximumQueuedStates: readPositiveBudget(
		budget?.maximumQueuedStates,
		DefaultPlannerSearchBudget.maximumQueuedStates,
	),
	maximumTraceLength: readPositiveBudget(
		budget?.maximumTraceLength,
		DefaultPlannerSearchBudget.maximumTraceLength,
	),
});

const readAvailableQuantity = (node: SearchNode, itemId: IdSchema.Type) =>
	readPlannerRuntimeQuantity(node.runtime, itemId);

const readOutputCertaintyRank = (certainty: PlannerSearchOutputCertainty) =>
	certainty === "deterministic" ? 0 : 1;

const compareSearchNodes = (left: SearchNode, right: SearchNode) =>
	comparePlannerSearchPriority(left.priority, right.priority) ||
	readOutputCertaintyRank(left.outputCertainty) -
		readOutputCertaintyRank(right.outputCertainty) ||
	left.trace.length - right.trace.length ||
	left.elapsedMs - right.elapsedMs ||
	right.selectedWitnessProbability - left.selectedWitnessProbability ||
	left.order - right.order;

const readNextOutputCertainty = (
	current: PlannerSearchOutputCertainty,
	outputWitnessResolved: boolean,
): PlannerSearchOutputCertainty =>
	current === "possible" || outputWitnessResolved ? "possible" : "deterministic";

const readInitialSearchNode = ({
	fingerprint = "initial-runtime",
	itemId,
	order = 0,
	plan,
	quantity,
	runtime,
	scope,
	stateToken = 0,
}: {
	readonly fingerprint?: string;
	readonly itemId: IdSchema.Type;
	readonly order?: number;
	readonly plan: ReturnType<typeof readPlannerSearchPriorityPlan>;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
	readonly stateToken?: number;
}): SearchNode => ({
	elapsedMs: 0,
	fingerprint,
	order,
	outputCertainty: "deterministic",
	priority: readPlannerSearchPriority({
		itemId,
		plan,
		quantity,
		runtime,
		scope,
	}),
	runtime,
	selectedWitnessProbability: 1,
	stateToken,
	trace: [],
});

const readRelevantPresence = (node: SearchNode, scope: PlannerSearchScope) =>
	scope.itemIds.reduce(
		(total, itemId) => total + Number(readPlannerRuntimeQuantity(node.runtime, itemId) > 0),
		0,
	);

const isBetterNode = ({
	candidate,
	current,
	itemId,
	scope,
}: {
	readonly candidate: SearchNode;
	readonly current: SearchNode;
	readonly itemId: IdSchema.Type;
	readonly scope: PlannerSearchScope;
}) => {
	const candidateQuantity = readAvailableQuantity(candidate, itemId);
	const currentQuantity = readAvailableQuantity(current, itemId);
	if (candidateQuantity !== currentQuantity) return candidateQuantity > currentQuantity;
	const priorityDifference = comparePlannerSearchPriority(candidate.priority, current.priority);
	if (priorityDifference !== 0) return priorityDifference < 0;
	const candidatePresence = readRelevantPresence(candidate, scope);
	const currentPresence = readRelevantPresence(current, scope);
	if (candidatePresence !== currentPresence) return candidatePresence > currentPresence;
	const certaintyDifference =
		readOutputCertaintyRank(candidate.outputCertainty) -
		readOutputCertaintyRank(current.outputCertainty);
	if (certaintyDifference !== 0) return certaintyDifference < 0;
	if (candidate.trace.length !== current.trace.length)
		return candidate.trace.length < current.trace.length;
	if (candidate.elapsedMs !== current.elapsedMs) return candidate.elapsedMs < current.elapsedMs;
	return candidate.selectedWitnessProbability > current.selectedWitnessProbability;
};

const removeDominatedQueueNodes = (
	queue: SearchNode[],
	index: ReturnType<typeof createPlannerRuntimeDominanceIndex>,
) => queue.filter((node) => index.isActive(node.fingerprint, node.stateToken));

const pruneQueueToBudget = ({
	index,
	maximumQueuedStates,
	queue,
}: {
	readonly index: ReturnType<typeof createPlannerRuntimeDominanceIndex>;
	readonly maximumQueuedStates: number;
	readonly queue: SearchNode[];
}) => {
	const active = removeDominatedQueueNodes(queue, index).sort(compareSearchNodes);
	if (active.length <= maximumQueuedStates)
		return {
			pruned: false,
			queue: active,
		};

	for (const node of active.slice(maximumQueuedStates))
		index.deactivate(node.fingerprint, node.stateToken);
	return {
		pruned: true,
		queue: active.slice(0, maximumQueuedStates),
	};
};

const readInconclusive = ({
	best,
	blockedActionIds,
	budgetLimit,
	diagnostics = EmptyPlannerSearchDiagnostics,
	expandedStates,
	frontierSize,
	itemId,
	quantity,
	reason,
	scope,
	unsupportedActionIds,
	visitedStates,
}: {
	readonly best: SearchNode;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly budgetLimit?: PlannerSearchBudgetLimit;
	readonly diagnostics?: PlannerSearchDiagnostics;
	readonly expandedStates: number;
	readonly frontierSize: number;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly reason: Extract<
		PlannerSearchResult,
		{
			readonly type: "inconclusive";
		}
	>["reason"];
	readonly scope: PlannerSearchScope;
	readonly unsupportedActionIds: ReadonlySet<string>;
	readonly visitedStates: number;
}): PlannerSearchResult => ({
	bestAvailableQuantity: readAvailableQuantity(best, itemId),
	bestRuntime: best.runtime,
	blockedActionIds: [
		...blockedActionIds,
	].sort(compareIds),
	...(budgetLimit === undefined
		? {}
		: {
				budgetLimit,
			}),
	diagnostics,
	expandedStates,
	frontierSize,
	itemId,
	quantity,
	reason,
	trace: best.trace,
	type: "inconclusive",
	unsupportedActionIds: [
		...unsupportedActionIds,
	].sort(compareIds),
	unsupportedRoutes: scope.unsupportedRoutes,
	visitedStates,
});

interface PlannerScopeSearchResultBase {
	readonly best: SearchNode;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly expandedStates: number;
	readonly frontierSize: number;
	readonly unsupportedActionIds: ReadonlySet<string>;
	readonly visitedStates: number;
}

type PlannerScopeSearchResult =
	| (PlannerScopeSearchResultBase & {
			readonly node: SearchNode;
			readonly type: "completed";
	  })
	| (PlannerScopeSearchResultBase & {
			readonly budgetLimit?: PlannerSearchBudgetLimit;
			readonly reason: "non-quiescent-runtime" | "search-budget" | "search-exhausted";
			readonly type: "inconclusive";
	  });

const readRoutePlanDiagnostic = ({
	index,
	itemId,
	pass,
	scope,
}: {
	readonly index: number;
	readonly itemId: IdSchema.Type;
	readonly pass: PlannerScopeSearchResult;
	readonly scope: PlannerSearchScope;
}): PlannerSearchRoutePlanDiagnostic => {
	const targetRouteId = scope.preferredRouteByItemId.get(itemId)?.id;
	return {
		actionCount: scope.actions.length,
		bestAvailableQuantity: readAvailableQuantity(pass.best, itemId),
		bestTraceActionIds: pass.best.trace.map(({ actionId }) => actionId),
		blockedActionIds: [
			...pass.blockedActionIds,
		].sort(compareIds),
		...(pass.type === "inconclusive" && pass.budgetLimit !== undefined
			? {
					budgetLimit: pass.budgetLimit,
				}
			: {}),
		depthDiscrepancy: scope.depthDiscrepancy,
		detours: scope.choices.filter(({ alternativeIndex }) => alternativeIndex > 0),
		expandedStates: pass.expandedStates,
		frontierSize: pass.frontierSize,
		index,
		maximumDetourDepth: scope.maximumDetourDepth,
		outcome: pass.type === "completed" ? "completed" : pass.reason,
		routeCount: scope.routeIds.length,
		routeDiscrepancy: scope.routeDiscrepancy,
		...(targetRouteId === undefined
			? {}
			: {
					targetRouteId,
				}),
		unsupportedActionIds: [
			...pass.unsupportedActionIds,
		].sort(compareIds),
		visitedStates: pass.visitedStates,
	};
};

const searchPlannerScopeFx = Effect.fn("searchPlannerScopeFx")(function* ({
	budget,
	graph,
	itemId,
	quantity,
	runtime,
	scope,
}: {
	readonly budget: PlannerSearchBudget;
	readonly graph: PlannerAcquisitionGraph;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
}) {
	const priorityPlan = readPlannerSearchPriorityPlan({
		graph,
		scope,
	});
	const dominanceIndex = createPlannerRuntimeDominanceIndex();
	const initialRegistration = dominanceIndex.register({
		label: {
			elapsedMs: 0,
			outputCertainty: "deterministic",
			selectedWitnessProbability: 1,
			traceLength: 0,
		},
		runtime,
	});
	if (!initialRegistration.accepted)
		return yield* Effect.die(new Error("Planner rejected its initial runtime state."));
	const initial = readInitialSearchNode({
		fingerprint: initialRegistration.fingerprint,
		itemId,
		plan: priorityPlan,
		quantity,
		runtime,
		scope,
		stateToken: initialRegistration.token,
	});
	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	let queue: SearchNode[] = [
		initial,
	];
	let expandedStates = 0;
	let best = initial;
	let nextOrder = 1;
	let queueBudgetPruned = false;
	let traceBudgetReached = false;

	while (queue.length > 0) {
		queue = removeDominatedQueueNodes(queue, dominanceIndex);
		if (queue.length === 0) break;
		if (expandedStates >= budget.maximumExpandedStates)
			return {
				best,
				blockedActionIds,
				budgetLimit: "maximumExpandedStates" as const,
				expandedStates,
				frontierSize: queue.length,
				reason: "search-budget" as const,
				type: "inconclusive" as const,
				unsupportedActionIds,
				visitedStates: dominanceIndex.readFingerprintCount(),
			};

		queue.sort(compareSearchNodes);
		const node = queue.shift();
		if (node === undefined) continue;
		if (node.trace.length >= budget.maximumTraceLength) {
			traceBudgetReached = true;
			continue;
		}
		expandedStates += 1;

		const candidateGroups = readPlannerSearchCandidateGroups({
			graph,
			itemId,
			plan: priorityPlan,
			quantity,
			runtime: node.runtime,
			scope,
		});
		for (const group of candidateGroups) {
			let groupAdvanced = false;
			for (const candidate of group.actions) {
				const result = yield* runPlannerActionFx({
					action: candidate.action,
					outputWitness: candidate.outputWitness,
					runtime: node.runtime,
				});
				if (result.type === "blocked") {
					blockedActionIds.add(candidate.id);
					continue;
				}
				if (result.type === "unsupported") {
					unsupportedActionIds.add(candidate.id);
					continue;
				}
				groupAdvanced = true;

				const outputWitnessResolved =
					candidate.outputMode === "existential" && result.outputWitnessResolved;
				const nextSelectedWitnessProbability =
					node.selectedWitnessProbability *
					(outputWitnessResolved
						? candidate.outputWitness.statistics.maximumQuantityProbability
						: 1);
				const itemFlow = yield* readPlannerActionItemFlowFx({
					after: result.runtime,
					before: node.runtime,
				});
				const spentChargeQuantities = yield* readPlannerActionChargeFlowFx({
					before: node.runtime,
					events: result.events,
				});
				const nextTrace: ReadonlyArray<PlannerSearchTraceEntry> = [
					...node.trace,
					{
						action: candidate.action,
						actionId: candidate.actionId,
						actor: result.actor,
						consumedItemQuantities: itemFlow.consumedItemQuantities,
						elapsedMs: result.elapsedMs,
						events: result.events,
						outputResolution: outputWitnessResolved
							? {
									outputItemId: candidate.outputWitness.outputItemId,
									routeId: candidate.outputWitness.routeId,
									statistics: candidate.outputWitness.statistics,
									type: "existential" as const,
									witnessId: candidate.outputWitness.witnessId,
								}
							: {
									type: "canonical" as const,
								},
						outputItemIds: candidate.outputItemIds,
						producedItemQuantities: itemFlow.producedItemQuantities,
						routeIds: candidate.routeIds,
						spentChargeQuantities,
					},
				];
				const nextElapsedMs = node.elapsedMs + result.elapsedMs;
				const nextOutputCertainty = readNextOutputCertainty(
					node.outputCertainty,
					outputWitnessResolved,
				);
				const registration = dominanceIndex.register({
					label: {
						elapsedMs: nextElapsedMs,
						outputCertainty: nextOutputCertainty,
						selectedWitnessProbability: nextSelectedWitnessProbability,
						traceLength: nextTrace.length,
					},
					runtime: result.runtime,
				});
				if (!registration.accepted) continue;
				const next: SearchNode = {
					elapsedMs: nextElapsedMs,
					fingerprint: registration.fingerprint,
					order: nextOrder,
					outputCertainty: nextOutputCertainty,
					priority: readPlannerSearchPriority({
						itemId,
						plan: priorityPlan,
						quantity,
						runtime: result.runtime,
						scope,
					}),
					runtime: result.runtime,
					selectedWitnessProbability: nextSelectedWitnessProbability,
					stateToken: registration.token,
					trace: nextTrace,
				};
				nextOrder += 1;
				if (
					isBetterNode({
						candidate: next,
						current: best,
						itemId,
						scope,
					})
				)
					best = next;
				if (!isPlannerRuntimeQuiescent(next.runtime))
					return {
						best: next,
						blockedActionIds,
						expandedStates,
						frontierSize: queue.length,
						reason: "non-quiescent-runtime" as const,
						type: "inconclusive" as const,
						unsupportedActionIds,
						visitedStates: dominanceIndex.readFingerprintCount(),
					};

				if (readAvailableQuantity(next, itemId) >= quantity)
					return {
						best: next,
						blockedActionIds,
						expandedStates,
						frontierSize: queue.length,
						node: next,
						type: "completed" as const,
						unsupportedActionIds,
						visitedStates: dominanceIndex.readFingerprintCount(),
					};

				if (next.trace.length >= budget.maximumTraceLength) {
					traceBudgetReached = true;
					continue;
				}
				const boundedQueue = pruneQueueToBudget({
					index: dominanceIndex,
					maximumQueuedStates: budget.maximumQueuedStates,
					queue: [
						...queue,
						next,
					],
				});
				queue = boundedQueue.queue;
				queueBudgetPruned ||= boundedQueue.pruned;
			}
			if (groupAdvanced) break;
		}
	}

	return {
		best,
		blockedActionIds,
		...(traceBudgetReached || queueBudgetPruned
			? {
					budgetLimit: traceBudgetReached
						? ("maximumTraceLength" as const)
						: ("maximumQueuedStates" as const),
				}
			: {}),
		expandedStates,
		frontierSize: 0,
		reason:
			traceBudgetReached || queueBudgetPruned
				? ("search-budget" as const)
				: ("search-exhausted" as const),
		type: "inconclusive" as const,
		unsupportedActionIds,
		visitedStates: dominanceIndex.readFingerprintCount(),
	} satisfies PlannerScopeSearchResult;
});

/**
 * Searches forward through immutable runtime snapshots and delegates every transition to engine.
 *
 * Stochastic routes execute as explicit positive-probability output witnesses. Exhausted search is
 * inconclusive; only the optimistic acquisition graph may prove `no-finite-path`.
 */
export const searchPlannerRuntimeFx = Effect.fn("searchPlannerRuntimeFx")(function* ({
	budget: budgetOverride,
	graph,
	itemId,
	quantity = 1,
	runtime,
}: searchPlannerRuntimeFx.Props) {
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);

	const minimumScope = readPlannerSearchScope({
		graph,
		targetItemId: itemId,
	});
	const minimumPriorityPlan = readPlannerSearchPriorityPlan({
		graph,
		scope: minimumScope,
	});
	const initial = readInitialSearchNode({
		itemId,
		plan: minimumPriorityPlan,
		quantity,
		runtime,
		scope: minimumScope,
	});
	if (!isPlannerRuntimeQuiescent(runtime))
		return readInconclusive({
			best: initial,
			blockedActionIds: new Set(),
			expandedStates: 0,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "non-quiescent-runtime",
			scope: minimumScope,
			unsupportedActionIds: new Set(),
			visitedStates: 1,
		});

	const initialQuantity = readAvailableQuantity(initial, itemId);
	if (initialQuantity >= quantity) {
		const economics = yield* readPlannerExpectedEconomicsFx({
			graph,
			initialRuntime: runtime,
			itemId,
			quantity,
			trace: [],
		});
		return {
			availableQuantity: initialQuantity,
			diagnostics: EmptyPlannerSearchDiagnostics,
			economics,
			elapsedMs: 0,
			expandedStates: 0,
			itemId,
			outputCertainty: "deterministic",
			quantity,
			runtime,
			selectedWitnessProbability: 1,
			trace: [],
			type: "completed",
			visitedStates: 1,
		} satisfies PlannerSearchResult;
	}

	const structural = readPlannerStructuralReachability({
		graph,
		itemId,
	});
	if (structural.type !== "reachable")
		return {
			diagnostics: EmptyPlannerSearchDiagnostics,
			itemId,
			proof: structural,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerSearchResult;

	if (!minimumScope.supported)
		return readInconclusive({
			best: initial,
			blockedActionIds: new Set(),
			expandedStates: 0,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "unsupported-routes",
			scope: minimumScope,
			unsupportedActionIds: new Set(),
			visitedStates: 1,
		});

	const budget = readBudget(budgetOverride);
	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	let expandedStates = 0;
	let visitedStates = 0;
	let best = initial;
	let finalScope = minimumScope;
	const routePlanDiagnostics: PlannerSearchRoutePlanDiagnostic[] = [];
	let scopeCount = 0;

	for (const scope of iteratePlannerSearchScopes({
		graph,
		targetItemId: itemId,
	})) {
		scopeCount += 1;
		finalScope = scope;
		const priorityPlan = readPlannerSearchPriorityPlan({
			graph,
			scope,
		});
		best = {
			...best,
			priority: readPlannerSearchPriority({
				itemId,
				plan: priorityPlan,
				quantity,
				runtime: best.runtime,
				scope,
			}),
		};
		if (expandedStates >= budget.maximumExpandedStates)
			return readInconclusive({
				best,
				blockedActionIds,
				budgetLimit: "maximumExpandedStates",
				diagnostics: readPlannerSearchDiagnostics(routePlanDiagnostics),
				expandedStates,
				frontierSize: 0,
				itemId,
				quantity,
				reason: "search-budget",
				scope,
				unsupportedActionIds,
				visitedStates,
			});

		const pass = yield* searchPlannerScopeFx({
			budget: {
				...budget,
				maximumExpandedStates: budget.maximumExpandedStates - expandedStates,
			},
			graph,
			itemId,
			quantity,
			runtime,
			scope,
		});
		expandedStates += pass.expandedStates;
		visitedStates += pass.visitedStates;
		routePlanDiagnostics.push(
			readRoutePlanDiagnostic({
				index: scopeCount,
				itemId,
				pass,
				scope,
			}),
		);
		for (const actionId of pass.blockedActionIds) blockedActionIds.add(actionId);
		for (const actionId of pass.unsupportedActionIds) unsupportedActionIds.add(actionId);
		if (
			isBetterNode({
				candidate: pass.best,
				current: best,
				itemId,
				scope,
			})
		)
			best = pass.best;

		if (pass.type === "completed") {
			const economics = yield* readPlannerExpectedEconomicsFx({
				graph,
				initialRuntime: runtime,
				itemId,
				quantity,
				trace: pass.node.trace,
			});
			return {
				availableQuantity: readAvailableQuantity(pass.node, itemId),
				diagnostics: readPlannerSearchDiagnostics(routePlanDiagnostics, scopeCount),
				economics,
				elapsedMs: pass.node.elapsedMs,
				expandedStates,
				itemId,
				outputCertainty: pass.node.outputCertainty,
				quantity,
				runtime: pass.node.runtime,
				selectedWitnessProbability: pass.node.selectedWitnessProbability,
				trace: pass.node.trace,
				type: "completed",
				visitedStates,
			} satisfies PlannerSearchResult;
		}
		if (pass.reason === "non-quiescent-runtime")
			return readInconclusive({
				best,
				blockedActionIds,
				diagnostics: readPlannerSearchDiagnostics(routePlanDiagnostics),
				expandedStates,
				frontierSize: pass.frontierSize,
				itemId,
				quantity,
				reason: "non-quiescent-runtime",
				scope,
				unsupportedActionIds,
				visitedStates,
			});
		if (pass.reason === "search-budget")
			return readInconclusive({
				best,
				blockedActionIds,
				...(pass.budgetLimit === undefined
					? {}
					: {
							budgetLimit: pass.budgetLimit,
						}),
				diagnostics: readPlannerSearchDiagnostics(routePlanDiagnostics),
				expandedStates,
				frontierSize: pass.frontierSize,
				itemId,
				quantity,
				reason: "search-budget",
				scope,
				unsupportedActionIds,
				visitedStates,
			});
	}

	return readInconclusive({
		best,
		blockedActionIds,
		diagnostics: readPlannerSearchDiagnostics(routePlanDiagnostics),
		expandedStates,
		frontierSize: 0,
		itemId,
		quantity,
		reason:
			scopeCount === 0 || finalScope.unsupportedRoutes.length > 0
				? "unsupported-routes"
				: unsupportedActionIds.size > 0
					? "action-unsupported"
					: "search-exhausted",
		scope: finalScope,
		unsupportedActionIds,
		visitedStates,
	});
});
