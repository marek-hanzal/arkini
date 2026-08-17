import { Effect } from "effect";

import {
	type PlannerSearchBudget,
	type PlannerSearchBudgetLimit,
	type PlannerSearchDiagnostics,
	type PlannerSearchOutputCertainty,
	type PlannerSearchResult,
	type PlannerSearchRoutePlanDiagnostic,
} from "~/editor/planner/PlannerSearch";
import type { PlannerSearchScope } from "~/editor/planner/PlannerSearchScope";
import type { PlannerRuntimeDominanceIndex } from "~/editor/planner/PlannerRuntimeDominanceIndex";
import { createPlannerRuntimeDominanceIndexFx } from "~/editor/planner/createPlannerRuntimeDominanceIndexFx";
import { isPlannerRuntimeQuiescentFx } from "~/editor/planner/isPlannerRuntimeQuiescentFx";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerSearchBudgetFx } from "~/editor/planner/readPlannerSearchBudgetFx";
import { readPlannerSearchCandidateGroupsFx } from "~/editor/planner/readPlannerSearchCandidateGroupsFx";
import type { PlannerActiveItemDemand } from "~/editor/planner/PlannerActiveItemDemand";
import type { PlannerSearchPriority } from "~/editor/planner/PlannerSearchPriority";
import type { PlannerSearchPriorityPlan } from "~/editor/planner/PlannerSearchPriorityPlan";
import { readPlannerActiveDemandFx } from "~/editor/planner/readPlannerActiveDemandFx";
import { readPlannerSearchPriorityFx } from "~/editor/planner/readPlannerSearchPriorityFx";
import { readPlannerSearchPriorityPlanFx } from "~/editor/planner/readPlannerSearchPriorityPlanFx";
import {
	readPlannerSearchScopeFx,
	readPlannerSearchScopesFx,
} from "~/editor/planner/readPlannerSearchScopeFx";
import { readPlannerStructuralReachabilityFx } from "~/editor/planner/readPlannerStructuralReachabilityFx";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
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

interface SearchNode extends PlannerSearchExecutionState {
	readonly activeDemand: ReadonlyMap<IdSchema.Type, PlannerActiveItemDemand>;
	readonly fingerprint: string;
	readonly order: number;
	readonly priority: PlannerSearchPriority;
	readonly stateToken: number;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRuntimeQuantity = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) =>
	runtime.items.reduce((total, item) => total + (item.item.id === itemId ? item.quantity : 0), 0);

const compareSearchPriority = (left: PlannerSearchPriority, right: PlannerSearchPriority) => {
	const maximumDepth = Math.max(
		left.preferredProgressByDepth.length,
		right.preferredProgressByDepth.length,
	);
	for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
		const difference =
			(right.preferredProgressByDepth[depth] ?? 0) -
			(left.preferredProgressByDepth[depth] ?? 0);
		if (difference !== 0) return difference;
	}
	for (let depth = maximumDepth - 1; depth >= 0; depth -= 1) {
		const difference =
			(right.preferredHeadroomByDepth[depth] ?? 0) -
			(left.preferredHeadroomByDepth[depth] ?? 0);
		if (difference !== 0) return difference;
	}
	return right.scopeProgress - left.scopeProgress;
};

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

const readAvailableQuantity = (node: SearchNode, itemId: IdSchema.Type) =>
	readRuntimeQuantity(node.runtime, itemId);

const canWidenPlannerSearchScope = (scope: PlannerSearchScope) =>
	scope.choices.some(
		({ alternativeCount, alternativeIndex }) => alternativeIndex + 1 < alternativeCount,
	);

const readOutputCertaintyRank = (certainty: PlannerSearchOutputCertainty) =>
	certainty === "deterministic" ? 0 : 1;

const compareSearchNodes = (left: SearchNode, right: SearchNode) =>
	compareSearchPriority(left.priority, right.priority) ||
	readOutputCertaintyRank(left.outputCertainty) -
		readOutputCertaintyRank(right.outputCertainty) ||
	left.trace.length - right.trace.length ||
	left.elapsedMs - right.elapsedMs ||
	right.selectedWitnessProbability - left.selectedWitnessProbability ||
	left.order - right.order;

const readInitialSearchNodeFx = Effect.fn("readInitialSearchNodeFx")(function* ({
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
	readonly plan: PlannerSearchPriorityPlan;
	readonly quantity: number;
	readonly runtime: RuntimeSchema.Type;
	readonly scope: PlannerSearchScope;
	readonly stateToken?: number;
}) {
	const activeDemand = yield* readPlannerActiveDemandFx({
		itemId,
		plan,
		quantity,
		runtime,
	});
	return {
		activeDemand,
		elapsedMs: 0,
		fingerprint,
		order,
		outputCertainty: "deterministic",
		priority: yield* readPlannerSearchPriorityFx({
			activeDemand,
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
	} satisfies SearchNode;
});
const readRelevantPresence = (node: SearchNode, scope: PlannerSearchScope) =>
	scope.itemIds.reduce(
		(total, itemId) => total + Number(readRuntimeQuantity(node.runtime, itemId) > 0),
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
	const priorityDifference = compareSearchPriority(candidate.priority, current.priority);
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

const removeDominatedQueueNodesFx = Effect.fn("removeDominatedQueueNodesFx")(function* (
	queue: ReadonlyArray<SearchNode>,
	index: PlannerRuntimeDominanceIndex,
) {
	const active: SearchNode[] = [];
	for (const node of queue)
		if (yield* index.isActiveFx(node.fingerprint, node.stateToken)) active.push(node);
	return active;
});

const pruneQueueToBudgetFx = Effect.fn("pruneQueueToBudgetFx")(function* ({
	index,
	maximumQueuedStates,
	queue,
}: {
	readonly index: PlannerRuntimeDominanceIndex;
	readonly maximumQueuedStates: number;
	readonly queue: ReadonlyArray<SearchNode>;
}) {
	const active = (yield* removeDominatedQueueNodesFx(queue, index)).sort(compareSearchNodes);
	if (active.length <= maximumQueuedStates)
		return {
			pruned: false,
			queue: active,
		};

	for (const node of active.slice(maximumQueuedStates))
		yield* index.deactivateFx(node.fingerprint, node.stateToken);
	return {
		pruned: true,
		queue: active.slice(0, maximumQueuedStates),
	};
});

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
	const priorityPlan = yield* readPlannerSearchPriorityPlanFx({
		graph,
		scope,
	});
	const dominanceIndex = yield* createPlannerRuntimeDominanceIndexFx();
	const initialRegistration = yield* dominanceIndex.registerFx({
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
	const initial = yield* readInitialSearchNodeFx({
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
	let best: SearchNode = initial;
	let nextOrder = 1;
	let queueBudgetPruned = false;
	let traceBudgetReached = false;

	while (queue.length > 0) {
		queue = yield* removeDominatedQueueNodesFx(queue, dominanceIndex);
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
				visitedStates: yield* dominanceIndex.readFingerprintCountFx,
			};

		queue.sort(compareSearchNodes);
		const node = queue.shift();
		if (node === undefined) continue;
		if (node.trace.length >= budget.maximumTraceLength) {
			traceBudgetReached = true;
			continue;
		}
		expandedStates += 1;

		const candidateGroups = yield* readPlannerSearchCandidateGroupsFx({
			activeDemand: node.activeDemand,
			graph,
			plan: priorityPlan,
			runtime: node.runtime,
			scope,
		});
		for (const group of candidateGroups) {
			let groupAdvanced = false;
			for (const candidate of group.actions) {
				const transition = yield* runPlannerSearchCandidateFx({
					candidate,
					state: node,
				});
				if (transition.type === "blocked") {
					blockedActionIds.add(candidate.id);
					continue;
				}
				if (transition.type === "unsupported") {
					unsupportedActionIds.add(candidate.id);
					continue;
				}
				groupAdvanced = true;

				const nextTrace = transition.state.trace;
				const nextElapsedMs = transition.state.elapsedMs;
				const nextOutputCertainty = transition.state.outputCertainty;
				const nextSelectedWitnessProbability = transition.state.selectedWitnessProbability;
				const registration = yield* dominanceIndex.registerFx({
					label: {
						elapsedMs: nextElapsedMs,
						outputCertainty: nextOutputCertainty,
						selectedWitnessProbability: nextSelectedWitnessProbability,
						traceLength: nextTrace.length,
					},
					runtime: transition.state.runtime,
				});
				if (!registration.accepted) continue;
				const nextActiveDemand = yield* readPlannerActiveDemandFx({
					itemId,
					plan: priorityPlan,
					quantity,
					runtime: transition.state.runtime,
				});
				const next: SearchNode = {
					activeDemand: nextActiveDemand,
					elapsedMs: nextElapsedMs,
					fingerprint: registration.fingerprint,
					order: nextOrder,
					outputCertainty: nextOutputCertainty,
					priority: yield* readPlannerSearchPriorityFx({
						activeDemand: nextActiveDemand,
						itemId,
						plan: priorityPlan,
						quantity,
						runtime: transition.state.runtime,
						scope,
					}),
					runtime: transition.state.runtime,
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
				if (!(yield* isPlannerRuntimeQuiescentFx(next.runtime)))
					return {
						best: next,
						blockedActionIds,
						expandedStates,
						frontierSize: queue.length,
						reason: "non-quiescent-runtime" as const,
						type: "inconclusive" as const,
						unsupportedActionIds,
						visitedStates: yield* dominanceIndex.readFingerprintCountFx,
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
						visitedStates: yield* dominanceIndex.readFingerprintCountFx,
					};

				if (next.trace.length >= budget.maximumTraceLength) {
					traceBudgetReached = true;
					continue;
				}
				const boundedQueue = yield* pruneQueueToBudgetFx({
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
		visitedStates: yield* dominanceIndex.readFingerprintCountFx,
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

	const minimumScope = yield* readPlannerSearchScopeFx({
		graph,
		targetItemId: itemId,
	});
	const minimumPriorityPlan = yield* readPlannerSearchPriorityPlanFx({
		graph,
		scope: minimumScope,
	});
	const initial = yield* readInitialSearchNodeFx({
		itemId,
		plan: minimumPriorityPlan,
		quantity,
		runtime,
		scope: minimumScope,
	});
	if (!(yield* isPlannerRuntimeQuiescentFx(runtime)))
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

	const structural = yield* readPlannerStructuralReachabilityFx({
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

	const budget = yield* readPlannerSearchBudgetFx(budgetOverride);
	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	let expandedStates = 0;
	let visitedStates = 0;
	let best: SearchNode = initial;
	let finalScope: PlannerSearchScope = minimumScope;
	const routePlanDiagnostics: PlannerSearchRoutePlanDiagnostic[] = [];
	let scopeCount = 0;

	const scopes = yield* readPlannerSearchScopesFx({
		graph,
		maximumScopes: budget.maximumRoutePlans,
		targetItemId: itemId,
	});
	for (const scope of scopes) {
		scopeCount += 1;
		finalScope = scope;
		const priorityPlan = yield* readPlannerSearchPriorityPlanFx({
			graph,
			scope,
		});
		const bestActiveDemand = yield* readPlannerActiveDemandFx({
			itemId,
			plan: priorityPlan,
			quantity,
			runtime: best.runtime,
		});
		best = {
			...best,
			activeDemand: bestActiveDemand,
			priority: yield* readPlannerSearchPriorityFx({
				activeDemand: bestActiveDemand,
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
		if (
			routePlanDiagnostics.length >= budget.maximumRoutePlans &&
			canWidenPlannerSearchScope(scope)
		)
			return readInconclusive({
				best,
				blockedActionIds,
				budgetLimit: "maximumRoutePlans",
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
