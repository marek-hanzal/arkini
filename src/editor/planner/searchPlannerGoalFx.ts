import { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchBudgetLimit,
	PlannerGoalSearchDiagnostics,
	PlannerGoalSearchResult,
} from "~/editor/planner/PlannerGoalSearch";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import {
	type PlannerAcquisitionGraph,
	type PlannerAcquisitionRequirement,
	type PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { isPlannerRuntimeQuiescent } from "~/editor/planner/isPlannerRuntimeQuiescent";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerGoalSearchBudget } from "~/editor/planner/readPlannerGoalSearchBudget";
import { readPlannerGoalViability } from "~/editor/planner/readPlannerGoalViability";
import { readPlannerRuntimeChargeCapacity } from "~/editor/planner/readPlannerRuntimeChargeCapacity";
import { readPlannerRuntimeFingerprint } from "~/editor/planner/readPlannerRuntimeFingerprint";
import { readPlannerRuntimeQuantity } from "~/editor/planner/readPlannerRuntimeQuantity";
import { isPlannerAcquisitionRouteReady } from "~/editor/planner/readPlannerSearchCandidateGroups";
import { readPlannerSearchActions } from "~/editor/planner/readPlannerSearchActions";
import { readPlannerStructuralReachability } from "~/editor/planner/readPlannerStructuralReachability";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace searchPlannerGoalFx {
	export interface Props {
		readonly budget?: Partial<PlannerGoalSearchBudget>;
		readonly graph: PlannerAcquisitionGraph;
		readonly itemId: IdSchema.Type;
		readonly quantity?: number;
		readonly runtime: RuntimeSchema.Type;
	}
}

interface PlannerResourceGoalTask {
	readonly itemId: IdSchema.Type;
	readonly minimumCharges: number;
	readonly minimumQuantity: number;
	readonly type: "resource";
}

interface PlannerRouteTask {
	readonly candidate: PlannerSearchAction;
	readonly route: PlannerAcquisitionRoute;
	readonly type: "route";
}

type PlannerGoalTask = PlannerResourceGoalTask | PlannerRouteTask;

interface PlannerGoalBranch {
	readonly agenda: ReadonlyArray<PlannerGoalTask>;
	readonly choicePath: ReadonlyArray<number>;
	readonly execution: PlannerSearchExecutionState;
}

interface PlannerRequirementDemand {
	charges: number;
	consumed: number;
	retained: number;
	sourcePriority: number;
}

interface PlannerRequirementChoice {
	readonly goal: PlannerResourceGoalTask;
	readonly key: string;
	readonly sourcePriority: number;
}

interface PlannerGoalSearchCounters {
	attemptedActions: number;
	backtracks: number;
	blockedBranches: number;
	createdBranches: number;
	deadEndBranches: number;
	duplicateBranches: number;
	expandedBranches: number;
	maximumAgendaDepth: number;
	maximumFrontierSize: number;
	unsupportedBranches: number;
}

type PlannerBranchExpansion = {
	readonly attemptedActionId?: string;
} & (
	| {
			readonly branch: PlannerGoalBranch;
			readonly type: "completed";
	  }
	| {
			readonly actionId?: string;
			readonly reason: "blocked" | "dead-end" | "unsupported";
			readonly type: "dead";
	  }
	| {
			readonly children: ReadonlyArray<PlannerGoalBranch>;
			readonly type: "expanded";
	  }
	| {
			readonly branch: PlannerGoalBranch;
			readonly type: "non-quiescent";
	  }
);

type PlannerBranchBatchResult =
	| {
			readonly branch: PlannerGoalBranch;
			readonly expansion: PlannerBranchExpansion;
			readonly type: "expanded";
	  }
	| {
			readonly branch: PlannerGoalBranch;
			readonly limit: "maximumAgendaDepth" | "maximumTraceLength";
			readonly type: "budget";
	  };

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readInitialExecution = (runtime: RuntimeSchema.Type): PlannerSearchExecutionState => ({
	elapsedMs: 0,
	outputCertainty: "deterministic",
	runtime,
	selectedWitnessProbability: 1,
	trace: [],
});

const readInitialResourceGoal = (
	itemId: IdSchema.Type,
	quantity: number,
): PlannerResourceGoalTask => ({
	itemId,
	minimumCharges: 0,
	minimumQuantity: quantity,
	type: "resource",
});

const isResourceGoalSatisfied = (goal: PlannerResourceGoalTask, runtime: RuntimeSchema.Type) =>
	readPlannerRuntimeQuantity(runtime, goal.itemId) >= goal.minimumQuantity &&
	readPlannerRuntimeChargeCapacity(runtime, goal.itemId) >= goal.minimumCharges;

const isTargetGoalSatisfied = (goal: PlannerItemGoal, runtime: RuntimeSchema.Type) =>
	readPlannerRuntimeQuantity(runtime, goal.itemId) >= goal.quantity;

const readRequirementSourcePriority = (source: PlannerAcquisitionRequirement["source"]) => {
	switch (source) {
		case "owner":
		case "merge-source":
		case "merge-target":
			return 0;
		case "charged-item":
		case "temporary-item":
			return 1;
		case "deposit-input":
		case "material-input":
			return 2;
		case "line-condition":
		case "output-condition":
			return 3;
	}
};

const addRequirementDemand = (
	demandByItemId: Map<IdSchema.Type, PlannerRequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		charges: 0,
		consumed: 0,
		retained: 0,
		sourcePriority: readRequirementSourcePriority(requirement.source),
	};
	if (requirement.usage === "consume") demand.consumed += requirement.minimumQuantity;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	if (requirement.usage === "charge") demand.charges += requirement.chargeCost ?? 0;
	demand.sourcePriority = Math.min(
		demand.sourcePriority,
		readRequirementSourcePriority(requirement.source),
	);
	demandByItemId.set(requirement.itemId, demand);
};

const readRequirementGoal = (
	requirement: PlannerAcquisitionRequirement,
): PlannerResourceGoalTask => ({
	itemId: requirement.itemId,
	minimumCharges: requirement.usage === "charge" ? (requirement.chargeCost ?? 0) : 0,
	minimumQuantity: requirement.minimumQuantity,
	type: "resource",
});

const readAllOfRequirementChoices = (
	route: PlannerAcquisitionRoute,
	runtime: RuntimeSchema.Type,
): ReadonlyArray<PlannerRequirementChoice> => {
	const demandByItemId = new Map<IdSchema.Type, PlannerRequirementDemand>();
	for (const requirement of route.requirements.allOf)
		addRequirementDemand(demandByItemId, requirement);
	return [
		...demandByItemId,
	].flatMap(([itemId, demand]) => {
		const goal: PlannerResourceGoalTask = {
			itemId,
			minimumCharges: demand.charges,
			minimumQuantity: demand.consumed + demand.retained,
			type: "resource",
		};
		return isResourceGoalSatisfied(goal, runtime)
			? []
			: [
					{
						goal,
						key: JSON.stringify([
							"all-of",
							route.id,
							itemId,
						]),
						sourcePriority: demand.sourcePriority,
					},
				];
	});
};

const readAnyOfRequirementChoices = (
	route: PlannerAcquisitionRoute,
	runtime: RuntimeSchema.Type,
): ReadonlyArray<PlannerRequirementChoice> =>
	route.requirements.anyOf.flatMap((clause, clauseIndex) => {
		if (
			clause.some((requirement) =>
				isResourceGoalSatisfied(readRequirementGoal(requirement), runtime),
			)
		)
			return [];
		return clause.map((requirement, alternativeIndex) => ({
			goal: readRequirementGoal(requirement),
			key: JSON.stringify([
				"any-of",
				route.id,
				clauseIndex,
				alternativeIndex,
			]),
			sourcePriority: readRequirementSourcePriority(requirement.source),
		}));
	});

const compareRequirementChoices = (
	graph: PlannerAcquisitionGraph,
	left: PlannerRequirementChoice,
	right: PlannerRequirementChoice,
) =>
	left.sourcePriority - right.sourcePriority ||
	(graph.depthByItemId.get(right.goal.itemId) ?? 0) -
		(graph.depthByItemId.get(left.goal.itemId) ?? 0) ||
	compareIds(left.goal.itemId, right.goal.itemId) ||
	left.goal.minimumQuantity - right.goal.minimumQuantity ||
	left.goal.minimumCharges - right.goal.minimumCharges ||
	compareIds(left.key, right.key);

const readUnmetRequirementChoices = ({
	graph,
	route,
	runtime,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly route: PlannerAcquisitionRoute;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const choices = [
		...readAllOfRequirementChoices(route, runtime),
		...readAnyOfRequirementChoices(route, runtime),
	].sort((left, right) => compareRequirementChoices(graph, left, right));
	return [
		...new Map(
			choices.map((choice) => [
				JSON.stringify([
					choice.goal.itemId,
					choice.goal.minimumQuantity,
					choice.goal.minimumCharges,
				]),
				choice,
			]),
		).values(),
	];
};

const compareRoutes = (
	graph: PlannerAcquisitionGraph,
	runtime: RuntimeSchema.Type,
	left: PlannerAcquisitionRoute,
	right: PlannerAcquisitionRoute,
) =>
	Number(isPlannerAcquisitionRouteReady(right, runtime)) -
		Number(isPlannerAcquisitionRouteReady(left, runtime)) ||
	(graph.routeDepthById.get(left.id) ?? Number.POSITIVE_INFINITY) -
		(graph.routeDepthById.get(right.id) ?? Number.POSITIVE_INFINITY) ||
	compareIds(left.id, right.id);

const readResourceRouteBranches = ({
	branch,
	goal,
	graph,
	rest,
}: {
	readonly branch: PlannerGoalBranch;
	readonly goal: PlannerResourceGoalTask;
	readonly graph: PlannerAcquisitionGraph;
	readonly rest: ReadonlyArray<PlannerGoalTask>;
}): ReadonlyArray<PlannerGoalBranch> => {
	const routes = [
		...(graph.routesByOutputItemId.get(goal.itemId) ?? []),
	]
		.filter((route) => route.output.maximumQuantity > 0)
		.sort((left, right) => compareRoutes(graph, branch.execution.runtime, left, right));
	const options = routes.flatMap((route) =>
		readPlannerSearchActions({
			graph,
			routes: [
				route,
			],
		}).map((candidate) => ({
			candidate,
			route,
		})),
	);
	return options.map(({ candidate, route }, index) => ({
		agenda: [
			{
				candidate,
				route,
				type: "route" as const,
			},
			goal,
			...rest,
		],
		choicePath:
			options.length > 1
				? [
						...branch.choicePath,
						index,
					]
				: branch.choicePath,
		execution: branch.execution,
	}));
};

const readTaskSignature = (task: PlannerGoalTask) => {
	switch (task.type) {
		case "resource":
			return [
				"resource",
				task.itemId,
				task.minimumQuantity,
				task.minimumCharges,
			];
		case "route":
			return [
				"route",
				task.route.id,
				task.candidate.id,
			];
	}
};

const readBranchKey = (branch: PlannerGoalBranch) =>
	JSON.stringify([
		readPlannerRuntimeFingerprint(branch.execution.runtime),
		branch.execution.outputCertainty,
		branch.agenda.map(readTaskSignature),
	]);

const compareChoicePaths = (left: ReadonlyArray<number>, right: ReadonlyArray<number>) => {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return left.length - right.length;
};

const compareBranches = (left: PlannerGoalBranch, right: PlannerGoalBranch) =>
	compareChoicePaths(left.choicePath, right.choicePath) ||
	left.agenda.length - right.agenda.length ||
	left.execution.trace.length - right.execution.trace.length ||
	compareIds(readBranchKey(left), readBranchKey(right));

const isBetterBranch = (
	candidate: PlannerGoalBranch,
	current: PlannerGoalBranch,
	targetItemId: IdSchema.Type,
) => {
	const candidateQuantity = readPlannerRuntimeQuantity(candidate.execution.runtime, targetItemId);
	const currentQuantity = readPlannerRuntimeQuantity(current.execution.runtime, targetItemId);
	if (candidateQuantity !== currentQuantity) return candidateQuantity > currentQuantity;
	if (candidate.agenda.length !== current.agenda.length)
		return candidate.agenda.length < current.agenda.length;
	if (candidate.execution.trace.length !== current.execution.trace.length)
		return candidate.execution.trace.length < current.execution.trace.length;
	return compareChoicePaths(candidate.choicePath, current.choicePath) < 0;
};

const appendChoice = (
	branch: PlannerGoalBranch,
	index: number,
	optionCount: number,
): ReadonlyArray<number> =>
	optionCount > 1
		? [
				...branch.choicePath,
				index,
			]
		: branch.choicePath;

const expandPlannerGoalBranchFx = Effect.fn("expandPlannerGoalBranchFx")(function* ({
	branch,
	graph,
	targetGoal,
}: {
	readonly branch: PlannerGoalBranch;
	readonly graph: PlannerAcquisitionGraph;
	readonly targetGoal: PlannerItemGoal;
}): Effect.fn.Return<
	PlannerBranchExpansion,
	PlannerBudgetExceeded,
	GameConfigFx | PlannerBudgetFx
> {
	if (isTargetGoalSatisfied(targetGoal, branch.execution.runtime))
		return {
			branch,
			type: "completed",
		};

	const [task, ...rest] = branch.agenda;
	if (task === undefined)
		return {
			reason: "dead-end",
			type: "dead",
		};

	if (task.type === "resource") {
		if (isResourceGoalSatisfied(task, branch.execution.runtime))
			return {
				children: [
					{
						...branch,
						agenda: rest,
					},
				],
				type: "expanded",
			};

		const viability = readPlannerGoalViability({
			goal: {
				itemId: task.itemId,
				quantity: Math.max(1, task.minimumQuantity),
			},
			graph,
			runtime: branch.execution.runtime,
		});
		const routes = graph.routesByOutputItemId.get(task.itemId) ?? [];
		if (
			viability.type === "dead-end" ||
			(routes.length === 0 && !isResourceGoalSatisfied(task, branch.execution.runtime))
		)
			return {
				reason: "dead-end",
				type: "dead",
			};

		const children = readResourceRouteBranches({
			branch,
			goal: task,
			graph,
			rest,
		});
		return children.length === 0
			? {
					reason: "dead-end",
					type: "dead",
				}
			: {
					children,
					type: "expanded",
				};
	}

	const requirementChoices = readUnmetRequirementChoices({
		graph,
		route: task.route,
		runtime: branch.execution.runtime,
	});
	if (
		!isPlannerAcquisitionRouteReady(task.route, branch.execution.runtime) &&
		requirementChoices.length > 0
	)
		return {
			children: requirementChoices.map((choice, index) => ({
				agenda: [
					choice.goal,
					task,
					...rest,
				],
				choicePath: appendChoice(branch, index, requirementChoices.length),
				execution: branch.execution,
			})),
			type: "expanded",
		};

	const transition = yield* runPlannerSearchCandidateFx({
		candidate: task.candidate,
		state: branch.execution,
	});
	if (transition.type === "blocked")
		return {
			attemptedActionId: task.candidate.id,
			reason: "blocked",
			type: "dead",
		};
	if (transition.type === "unsupported")
		return {
			attemptedActionId: task.candidate.id,
			reason: "unsupported",
			type: "dead",
		};
	if (!isPlannerRuntimeQuiescent(transition.state.runtime))
		return {
			attemptedActionId: task.candidate.id,
			branch: {
				...branch,
				execution: transition.state,
			},
			type: "non-quiescent",
		};

	const targetViability = readPlannerGoalViability({
		goal: targetGoal,
		graph,
		runtime: transition.state.runtime,
	});
	if (targetViability.type === "dead-end")
		return {
			attemptedActionId: task.candidate.id,
			reason: "dead-end",
			type: "dead",
		};

	return {
		attemptedActionId: task.candidate.id,
		children: [
			{
				agenda: rest,
				choicePath: branch.choicePath,
				execution: transition.state,
			},
		],
		type: "expanded",
	};
});

const expandPlannerGoalBranchWithinBudgetFx = Effect.fn("expandPlannerGoalBranchWithinBudgetFx")(
	function* ({
		branch,
		budget,
		graph,
		targetGoal,
	}: {
		readonly branch: PlannerGoalBranch;
		readonly budget: PlannerGoalSearchBudget;
		readonly graph: PlannerAcquisitionGraph;
		readonly targetGoal: PlannerItemGoal;
	}): Effect.fn.Return<
		PlannerBranchBatchResult,
		PlannerBudgetExceeded,
		GameConfigFx | PlannerBudgetFx
	> {
		if (isTargetGoalSatisfied(targetGoal, branch.execution.runtime))
			return {
				branch,
				expansion: {
					branch,
					type: "completed",
				},
				type: "expanded",
			};
		if (branch.execution.trace.length >= budget.maximumTraceLength)
			return {
				branch,
				limit: "maximumTraceLength",
				type: "budget",
			};
		if (branch.agenda.length > budget.maximumAgendaDepth)
			return {
				branch,
				limit: "maximumAgendaDepth",
				type: "budget",
			};

		return {
			branch,
			expansion: yield* expandPlannerGoalBranchFx({
				branch,
				graph,
				targetGoal,
			}),
			type: "expanded",
		};
	},
);

const readCounters = (): PlannerGoalSearchCounters => ({
	attemptedActions: 0,
	backtracks: 0,
	blockedBranches: 0,
	createdBranches: 1,
	deadEndBranches: 0,
	duplicateBranches: 0,
	expandedBranches: 0,
	maximumAgendaDepth: 1,
	maximumFrontierSize: 1,
	unsupportedBranches: 0,
});

const readDiagnostics = ({
	budget,
	counters,
	winningChoicePath,
}: {
	readonly budget: PlannerGoalSearchBudget;
	readonly counters: PlannerGoalSearchCounters;
	readonly winningChoicePath?: ReadonlyArray<number>;
}): PlannerGoalSearchDiagnostics => ({
	...counters,
	maximumConcurrentBranches: budget.maximumConcurrentBranches,
	...(winningChoicePath === undefined
		? {}
		: {
				winningChoicePath,
			}),
});

const readBudgetLimit = (
	limits: ReadonlySet<PlannerGoalSearchBudgetLimit>,
): PlannerGoalSearchBudgetLimit | undefined => {
	const order: ReadonlyArray<PlannerGoalSearchBudgetLimit> = [
		"maximumExpandedBranches",
		"maximumQueuedBranches",
		"maximumTraceLength",
		"maximumAgendaDepth",
	];
	return order.find((limit) => limits.has(limit));
};

const readInconclusive = ({
	best,
	blockedActionIds,
	budget,
	budgetLimits,
	counters,
	frontierSize,
	itemId,
	quantity,
	reason,
	unsupportedActionIds,
}: {
	readonly best: PlannerGoalBranch;
	readonly blockedActionIds: ReadonlySet<string>;
	readonly budget: PlannerGoalSearchBudget;
	readonly budgetLimits: ReadonlySet<PlannerGoalSearchBudgetLimit>;
	readonly counters: PlannerGoalSearchCounters;
	readonly frontierSize: number;
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly reason: Extract<
		PlannerGoalSearchResult,
		{
			readonly type: "inconclusive";
		}
	>["reason"];
	readonly unsupportedActionIds: ReadonlySet<string>;
}): PlannerGoalSearchResult => {
	const budgetLimit = readBudgetLimit(budgetLimits);
	return {
		bestAvailableQuantity: readPlannerRuntimeQuantity(best.execution.runtime, itemId),
		bestExecution: best.execution,
		blockedActionIds: [
			...blockedActionIds,
		].sort(compareIds),
		...(budgetLimit === undefined
			? {}
			: {
					budgetLimit,
				}),
		diagnostics: readDiagnostics({
			budget,
			counters,
		}),
		frontierSize,
		itemId,
		quantity,
		reason,
		type: "inconclusive",
		unsupportedActionIds: [
			...unsupportedActionIds,
		].sort(compareIds),
	};
};

/**
 * Builds one concrete plan through branch-local immutable runtime snapshots.
 *
 * The acquisition graph chooses resource routes; the canonical engine decides every transition.
 * Sibling branches are expanded concurrently in deterministic waves and dead futures are discarded
 * by re-rooting structural viability in their resulting snapshots.
 */
export const searchPlannerGoalFx = Effect.fn("searchPlannerGoalFx")(function* ({
	budget: budgetOverride,
	graph,
	itemId,
	quantity = 1,
	runtime,
}: searchPlannerGoalFx.Props) {
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);

	const budget = readPlannerGoalSearchBudget(budgetOverride);
	const targetGoal: PlannerItemGoal = {
		itemId,
		quantity,
	};
	const initialExecution = readInitialExecution(runtime);
	const initial: PlannerGoalBranch = {
		agenda: [
			readInitialResourceGoal(itemId, quantity),
		],
		choicePath: [],
		execution: initialExecution,
	};
	const counters = readCounters();
	const emptyDiagnostics = readDiagnostics({
		budget,
		counters,
	});

	if (!isPlannerRuntimeQuiescent(runtime))
		return {
			bestAvailableQuantity: readPlannerRuntimeQuantity(runtime, itemId),
			bestExecution: initialExecution,
			blockedActionIds: [],
			diagnostics: emptyDiagnostics,
			frontierSize: 0,
			itemId,
			quantity,
			reason: "non-quiescent-runtime",
			type: "inconclusive",
			unsupportedActionIds: [],
		} satisfies PlannerGoalSearchResult;

	const structural = readPlannerStructuralReachability({
		graph,
		itemId,
	});
	if (structural.type !== "reachable")
		return {
			diagnostics: emptyDiagnostics,
			itemId,
			proof: structural,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerGoalSearchResult;

	const initialViability = readPlannerGoalViability({
		goal: targetGoal,
		graph,
		runtime,
	});
	if (initialViability.type === "dead-end")
		return {
			diagnostics: emptyDiagnostics,
			itemId,
			proof: initialViability.proof,
			quantity,
			type: "no-finite-path",
		} satisfies PlannerGoalSearchResult;
	if (initialViability.type === "satisfied") {
		const economics = yield* readPlannerExpectedEconomicsFx({
			graph,
			initialRuntime: runtime,
			itemId,
			quantity,
			trace: [],
		});
		return {
			availableQuantity: initialViability.availableQuantity,
			diagnostics: emptyDiagnostics,
			economics,
			execution: initialExecution,
			itemId,
			quantity,
			type: "completed",
		} satisfies PlannerGoalSearchResult;
	}

	const blockedActionIds = new Set<string>();
	const unsupportedActionIds = new Set<string>();
	const budgetLimits = new Set<PlannerGoalSearchBudgetLimit>();
	const visited = new Set<string>([
		readBranchKey(initial),
	]);
	let queue: PlannerGoalBranch[] = [
		initial,
	];
	let completions: PlannerGoalBranch[] = [];
	let best = initial;

	const readDeterministicCompletion = () => {
		if (completions.length === 0) return undefined;
		completions.sort(compareBranches);
		queue.sort(compareBranches);
		const completion = completions[0];
		const pending = queue[0];
		return completion !== undefined &&
			(pending === undefined || compareBranches(completion, pending) < 0)
			? completion
			: undefined;
	};

	while (queue.length > 0) {
		const readyCompletion = readDeterministicCompletion();
		if (readyCompletion !== undefined) {
			const economics = yield* readPlannerExpectedEconomicsFx({
				graph,
				initialRuntime: runtime,
				itemId,
				quantity,
				trace: readyCompletion.execution.trace,
			});
			return {
				availableQuantity: readPlannerRuntimeQuantity(
					readyCompletion.execution.runtime,
					itemId,
				),
				diagnostics: readDiagnostics({
					budget,
					counters,
					winningChoicePath: readyCompletion.choicePath,
				}),
				economics,
				execution: readyCompletion.execution,
				itemId,
				quantity,
				type: "completed",
			} satisfies PlannerGoalSearchResult;
		}

		if (counters.expandedBranches >= budget.maximumExpandedBranches) {
			budgetLimits.add("maximumExpandedBranches");
			break;
		}

		queue.sort(compareBranches);
		const remainingExpansionBudget = budget.maximumExpandedBranches - counters.expandedBranches;
		const batchSize = Math.min(
			budget.maximumConcurrentBranches,
			remainingExpansionBudget,
			queue.length,
		);
		const batch = queue.splice(0, batchSize);
		const expansions = yield* Effect.forEach(
			batch,
			(branch) =>
				expandPlannerGoalBranchWithinBudgetFx({
					branch,
					budget,
					graph,
					targetGoal,
				}),
			{
				concurrency: budget.maximumConcurrentBranches,
			},
		);
		counters.expandedBranches += batch.length;
		const producedChildren: PlannerGoalBranch[] = [];

		for (const result of expansions) {
			if (result.type === "budget") {
				budgetLimits.add(result.limit);
				counters.backtracks += 1;
				continue;
			}
			const expansion = result.expansion;
			if (expansion.attemptedActionId !== undefined) counters.attemptedActions += 1;
			if (expansion.type === "completed") {
				completions.push(expansion.branch);
				continue;
			}
			if (expansion.type === "non-quiescent")
				return readInconclusive({
					best: expansion.branch,
					blockedActionIds,
					budget,
					budgetLimits,
					counters,
					frontierSize: queue.length,
					itemId,
					quantity,
					reason: "non-quiescent-runtime",
					unsupportedActionIds,
				});
			if (expansion.type === "dead") {
				counters.deadEndBranches += 1;
				counters.backtracks += 1;
				if (expansion.reason === "blocked") {
					counters.blockedBranches += 1;
					if (expansion.attemptedActionId !== undefined)
						blockedActionIds.add(expansion.attemptedActionId);
				}
				if (expansion.reason === "unsupported") {
					counters.unsupportedBranches += 1;
					if (expansion.attemptedActionId !== undefined)
						unsupportedActionIds.add(expansion.attemptedActionId);
				}
				continue;
			}

			for (const child of expansion.children) {
				counters.createdBranches += 1;
				counters.maximumAgendaDepth = Math.max(
					counters.maximumAgendaDepth,
					child.agenda.length,
				);
				if (child.agenda.length > budget.maximumAgendaDepth) {
					budgetLimits.add("maximumAgendaDepth");
					continue;
				}
				if (child.execution.trace.length > budget.maximumTraceLength) {
					budgetLimits.add("maximumTraceLength");
					continue;
				}
				const key = readBranchKey(child);
				if (visited.has(key)) {
					counters.duplicateBranches += 1;
					continue;
				}
				visited.add(key);
				if (isBetterBranch(child, best, itemId)) best = child;
				producedChildren.push(child);
			}
		}

		queue = [
			...queue,
			...producedChildren,
		].sort(compareBranches);
		if (queue.length > budget.maximumQueuedBranches) {
			budgetLimits.add("maximumQueuedBranches");
			queue = queue.slice(0, budget.maximumQueuedBranches);
		}
		counters.maximumFrontierSize = Math.max(counters.maximumFrontierSize, queue.length);
	}

	const completion = readDeterministicCompletion() ?? completions.sort(compareBranches)[0];
	if (completion !== undefined) {
		const economics = yield* readPlannerExpectedEconomicsFx({
			graph,
			initialRuntime: runtime,
			itemId,
			quantity,
			trace: completion.execution.trace,
		});
		return {
			availableQuantity: readPlannerRuntimeQuantity(completion.execution.runtime, itemId),
			diagnostics: readDiagnostics({
				budget,
				counters,
				winningChoicePath: completion.choicePath,
			}),
			economics,
			execution: completion.execution,
			itemId,
			quantity,
			type: "completed",
		} satisfies PlannerGoalSearchResult;
	}

	return readInconclusive({
		best,
		blockedActionIds,
		budget,
		budgetLimits,
		counters,
		frontierSize: queue.length,
		itemId,
		quantity,
		reason:
			budgetLimits.size > 0
				? "search-budget"
				: unsupportedActionIds.size > 0
					? "action-unsupported"
					: "search-exhausted",
		unsupportedActionIds,
	});
});
