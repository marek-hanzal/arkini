import { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type {
	PlannerGoalSearchBudget,
	PlannerGoalSearchDiagnostics,
	PlannerGoalSearchResult,
	PlannerGoalSearchSubgoalSolver,
} from "~/editor/planner/PlannerGoalSearch";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import type { PlannerStrategyInconclusiveReason } from "~/editor/planner/PlannerStrategy";
import {
	type PlannerAcquisitionGraph,
	type PlannerAcquisitionRequirement,
	type PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { composePlannerSearchExecution } from "~/editor/planner/composePlannerSearchExecution";
import { isPlannerRuntimeQuiescent } from "~/editor/planner/isPlannerRuntimeQuiescent";
import { readPlannerExpectedEconomicsFx } from "~/editor/planner/readPlannerExpectedEconomicsFx";
import { readPlannerGoalAgendaViability } from "~/editor/planner/readPlannerGoalAgendaViability";
import { readPlannerGoalSearchBudget } from "~/editor/planner/readPlannerGoalSearchBudget";
import { readPlannerGoalViability } from "~/editor/planner/readPlannerGoalViability";
import { readPlannerItemGoalStatus } from "~/editor/planner/readPlannerItemGoalStatus";
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
		readonly minimumCharges?: number;
		readonly quantity?: number;
		readonly runtime: RuntimeSchema.Type;
		readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
	}
}

interface PlannerResourceGoalTask {
	readonly itemId: IdSchema.Type;
	readonly minimumCharges: number;
	readonly minimumQuantity: number;
	readonly resolution: "local" | "subgoal";
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
	readonly fallback?: PlannerGoalBranch;
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
	delegatedCompletedSubgoals: number;
	delegatedExpandedNodes: number;
	delegatedInconclusiveSubgoals: number;
	delegatedMaximumFrontierSize: number;
	delegatedNoFinitePathSubgoals: number;
	delegatedSubgoals: number;
	delegatedVisitedNodes: number;
	duplicateBranches: number;
	expandedBranches: number;
	maximumAgendaDepth: number;
	maximumFrontierSize: number;
	unsupportedBranches: number;
}

interface PlannerDelegatedSubgoalSummary {
	readonly blockedActionIds: ReadonlyArray<string>;
	readonly budgetLimit?: string;
	readonly metrics: {
		readonly expandedNodes: number;
		readonly frontierSize: number;
		readonly visitedNodes: number;
	};
	readonly outcome: "completed" | "inconclusive" | "no-finite-path";
	readonly reason?: PlannerStrategyInconclusiveReason;
	readonly unsupportedActionIds: ReadonlyArray<string>;
}

type PlannerBranchExpansion = {
	readonly attemptedActionId?: string;
	readonly delegatedSubgoal?: PlannerDelegatedSubgoalSummary;
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
	| {
			readonly branch: PlannerGoalBranch;
			readonly type: "unresolved";
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
	minimumCharges: number,
): PlannerResourceGoalTask => ({
	itemId,
	minimumCharges,
	minimumQuantity: quantity,
	resolution: "local",
	type: "resource",
});

const isResourceGoalSatisfied = (goal: PlannerResourceGoalTask, runtime: RuntimeSchema.Type) =>
	readPlannerRuntimeQuantity(runtime, goal.itemId) >= goal.minimumQuantity &&
	readPlannerRuntimeChargeCapacity(runtime, goal.itemId) >= goal.minimumCharges;

const isTargetGoalSatisfied = (goal: PlannerItemGoal, runtime: RuntimeSchema.Type) =>
	readPlannerItemGoalStatus(goal, runtime).satisfied;

const projectResourceGoal = (goal: PlannerResourceGoalTask): PlannerItemGoal => ({
	itemId: goal.itemId,
	minimumCharges: goal.minimumCharges,
	quantity: Math.max(1, goal.minimumQuantity),
});

const readAgendaItemGoals = (
	targetGoal: PlannerItemGoal,
	agenda: ReadonlyArray<PlannerGoalTask>,
): ReadonlyArray<PlannerItemGoal> => [
	targetGoal,
	...agenda.flatMap((task) =>
		task.type === "resource"
			? [
					projectResourceGoal(task),
				]
			: [],
	),
];

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
	resolution: "subgoal",
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
			resolution: "subgoal",
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

const readAnyOfRequirementChoiceGroups = (
	route: PlannerAcquisitionRoute,
	runtime: RuntimeSchema.Type,
): ReadonlyArray<ReadonlyArray<PlannerRequirementChoice>> =>
	route.requirements.anyOf.flatMap((clause, clauseIndex) => {
		if (
			clause.some((requirement) =>
				isResourceGoalSatisfied(readRequirementGoal(requirement), runtime),
			)
		)
			return [];
		return [
			clause.map((requirement, alternativeIndex) => ({
				goal: readRequirementGoal(requirement),
				key: JSON.stringify([
					"any-of",
					route.id,
					clauseIndex,
					alternativeIndex,
				]),
				sourcePriority: readRequirementSourcePriority(requirement.source),
			})),
		];
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

const deduplicateRequirementChoices = (choices: ReadonlyArray<PlannerRequirementChoice>) => [
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

const readUnmetRequirementChoices = ({
	graph,
	route,
	runtime,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly route: PlannerAcquisitionRoute;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const mandatory = deduplicateRequirementChoices(
		[
			...readAllOfRequirementChoices(route, runtime),
		].sort((left, right) => compareRequirementChoices(graph, left, right)),
	);
	if (mandatory.length > 0)
		return {
			choices: mandatory,
			type: "mandatory" as const,
		};

	const alternativeGroups = readAnyOfRequirementChoiceGroups(route, runtime)
		.map((choices) =>
			deduplicateRequirementChoices(
				[
					...choices,
				].sort((left, right) => compareRequirementChoices(graph, left, right)),
			),
		)
		.filter((choices) => choices.length > 0)
		.sort((left, right) => {
			const leftChoice = left[0];
			const rightChoice = right[0];
			return leftChoice === undefined || rightChoice === undefined
				? left.length - right.length
				: compareRequirementChoices(graph, leftChoice, rightChoice);
		});
	const choices = alternativeGroups[0];
	return choices === undefined
		? undefined
		: {
				choices,
				type: "alternatives" as const,
			};
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
		...(branch.fallback === undefined
			? {}
			: {
					fallback: branch.fallback,
				}),
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
				task.resolution,
			];
		case "route":
			return [
				"route",
				task.route.id,
				task.candidate.id,
			];
	}
};

const readBranchStateSignature = (branch: PlannerGoalBranch) => [
	readPlannerRuntimeFingerprint(branch.execution.runtime),
	branch.execution.outputCertainty,
	branch.agenda.map(readTaskSignature),
];

const readFallbackStateSignatures = (branch: PlannerGoalBranch) => {
	const signatures: Array<ReturnType<typeof readBranchStateSignature>> = [];
	const seen = new Set<PlannerGoalBranch>();
	let fallback = branch.fallback;
	while (fallback !== undefined && !seen.has(fallback)) {
		seen.add(fallback);
		signatures.push(readBranchStateSignature(fallback));
		fallback = fallback.fallback;
	}
	return signatures;
};

const readBranchKey = (branch: PlannerGoalBranch) =>
	JSON.stringify([
		readBranchStateSignature(branch),
		readFallbackStateSignatures(branch),
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

const readDelegatedSubgoalAgenda = ({
	goal,
	rest,
	targetGoal,
}: {
	readonly goal: PlannerResourceGoalTask;
	readonly rest: ReadonlyArray<PlannerGoalTask>;
	readonly targetGoal: PlannerItemGoal;
}): ReadonlyArray<PlannerItemGoal> => {
	const goals = [
		projectResourceGoal(goal),
		...readAgendaItemGoals(targetGoal, rest),
	];
	const demandByItemId = new Map<
		IdSchema.Type,
		{
			minimumCharges: number;
			quantity: number;
		}
	>();
	for (const itemGoal of goals) {
		const current = demandByItemId.get(itemGoal.itemId);
		demandByItemId.set(itemGoal.itemId, {
			minimumCharges: Math.max(current?.minimumCharges ?? 0, itemGoal.minimumCharges ?? 0),
			quantity: Math.max(current?.quantity ?? 0, itemGoal.quantity),
		});
	}
	return [
		projectResourceGoal(goal),
		...[
			...demandByItemId,
		]
			.filter(([itemId]) => itemId !== goal.itemId)
			.sort(([left], [right]) => compareIds(left, right))
			.map(([itemId, demand]) => ({
				itemId,
				minimumCharges: demand.minimumCharges,
				quantity: demand.quantity,
			})),
	];
};

const resolveDelegatedResourceGoalFx = Effect.fn("resolveDelegatedResourceGoalFx")(function* ({
	branch,
	goal,
	graph,
	rest,
	solveSubgoalFx,
	targetGoal,
}: {
	readonly branch: PlannerGoalBranch;
	readonly goal: PlannerResourceGoalTask;
	readonly graph: PlannerAcquisitionGraph;
	readonly rest: ReadonlyArray<PlannerGoalTask>;
	readonly solveSubgoalFx: PlannerGoalSearchSubgoalSolver;
	readonly targetGoal: PlannerItemGoal;
}): Effect.fn.Return<PlannerBranchExpansion, PlannerBudgetExceeded> {
	const result = yield* solveSubgoalFx({
		agenda: readDelegatedSubgoalAgenda({
			goal,
			rest,
			targetGoal,
		}),
		goal: projectResourceGoal(goal),
		reason: `constructive-subgoal:${goal.itemId}`,
		runtime: branch.execution.runtime,
	});
	const summary: PlannerDelegatedSubgoalSummary = {
		blockedActionIds: result.type === "inconclusive" ? result.blockedActionIds : [],
		...(result.type === "inconclusive" && result.budgetLimit !== undefined
			? {
					budgetLimit: result.budgetLimit,
				}
			: {}),
		metrics: result.metrics,
		outcome: result.type,
		...(result.type === "inconclusive"
			? {
					reason: result.reason,
				}
			: {}),
		unsupportedActionIds: result.type === "inconclusive" ? result.unsupportedActionIds : [],
	};

	if (result.type === "no-finite-path")
		return {
			delegatedSubgoal: summary,
			reason: "dead-end",
			type: "dead",
		};
	if (result.type === "inconclusive")
		return {
			branch,
			delegatedSubgoal: summary,
			type: "unresolved",
		};

	const status = readPlannerItemGoalStatus(projectResourceGoal(goal), result.execution.runtime);
	if (!status.satisfied)
		return yield* Effect.die(
			new Error(
				`Delegated planner subgoal ${goal.itemId} completed with ${status.availableQuantity}/${goal.minimumQuantity} items and ${status.availableCharges}/${goal.minimumCharges} charges.`,
			),
		);
	if (!isPlannerRuntimeQuiescent(result.execution.runtime))
		return yield* Effect.die(
			new Error(`Delegated planner subgoal ${goal.itemId} returned a non-quiescent runtime.`),
		);

	const execution = composePlannerSearchExecution(branch.execution, result.execution);
	const agendaViability = readPlannerGoalAgendaViability({
		goals: readAgendaItemGoals(targetGoal, rest),
		graph,
		runtime: execution.runtime,
	});
	if (agendaViability.type === "dead-end")
		return {
			delegatedSubgoal: summary,
			reason: "dead-end",
			type: "dead",
		};
	return {
		delegatedSubgoal: summary,
		children: [
			{
				agenda: rest,
				choicePath: branch.choicePath,
				execution,
				...(branch.fallback === undefined
					? {}
					: {
							fallback: branch.fallback,
						}),
			},
		],
		type: "expanded",
	};
});

const readLazyRequirementBranch = ({
	branch,
	choices,
	rest,
	task,
}: {
	readonly branch: PlannerGoalBranch;
	readonly choices: ReadonlyArray<PlannerRequirementChoice>;
	readonly rest: ReadonlyArray<PlannerGoalTask>;
	readonly task: PlannerRouteTask;
}) => {
	let fallback = branch.fallback;
	for (let index = choices.length - 1; index >= 0; index -= 1) {
		const choice = choices[index];
		if (choice === undefined) continue;
		fallback = {
			agenda: [
				choice.goal,
				task,
				...rest,
			],
			choicePath: appendChoice(branch, index, choices.length),
			execution: branch.execution,
			...(fallback === undefined
				? {}
				: {
						fallback,
					}),
		};
	}
	return fallback;
};

const expandPlannerGoalBranchFx = Effect.fn("expandPlannerGoalBranchFx")(function* ({
	branch,
	graph,
	solveSubgoalFx,
	targetGoal,
}: {
	readonly branch: PlannerGoalBranch;
	readonly graph: PlannerAcquisitionGraph;
	readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
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
		if (task.resolution === "subgoal" && solveSubgoalFx !== undefined)
			return yield* resolveDelegatedResourceGoalFx({
				branch,
				goal: task,
				graph,
				rest,
				solveSubgoalFx,
				targetGoal,
			});

		const viability = readPlannerGoalViability({
			goal: {
				itemId: task.itemId,
				minimumCharges: task.minimumCharges,
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

	const requirementChoice = readUnmetRequirementChoices({
		graph,
		route: task.route,
		runtime: branch.execution.runtime,
	});
	if (
		!isPlannerAcquisitionRouteReady(task.route, branch.execution.runtime) &&
		requirementChoice !== undefined
	) {
		if (requirementChoice.type === "mandatory") {
			const child = readLazyRequirementBranch({
				branch,
				choices: requirementChoice.choices,
				rest,
				task,
			});
			return child === undefined
				? {
						reason: "dead-end",
						type: "dead",
					}
				: {
						children: [
							child,
						],
						type: "expanded",
					};
		}

		return {
			children: requirementChoice.choices.map((choice, index) => ({
				agenda: [
					choice.goal,
					task,
					...rest,
				],
				choicePath: appendChoice(branch, index, requirementChoice.choices.length),
				execution: branch.execution,
				...(branch.fallback === undefined
					? {}
					: {
							fallback: branch.fallback,
						}),
			})),
			type: "expanded",
		};
	}

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

	const agendaViability = readPlannerGoalAgendaViability({
		goals: readAgendaItemGoals(targetGoal, rest),
		graph,
		runtime: transition.state.runtime,
	});
	if (agendaViability.type === "dead-end")
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
				...(branch.fallback === undefined
					? {}
					: {
							fallback: branch.fallback,
						}),
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
		solveSubgoalFx,
		targetGoal,
	}: {
		readonly branch: PlannerGoalBranch;
		readonly budget: PlannerGoalSearchBudget;
		readonly graph: PlannerAcquisitionGraph;
		readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
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
				solveSubgoalFx,
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
	delegatedCompletedSubgoals: 0,
	delegatedExpandedNodes: 0,
	delegatedInconclusiveSubgoals: 0,
	delegatedMaximumFrontierSize: 0,
	delegatedNoFinitePathSubgoals: 0,
	delegatedSubgoals: 0,
	delegatedVisitedNodes: 0,
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

const readBudgetLimit = (limits: ReadonlySet<string>): string | undefined => {
	const order: ReadonlyArray<string> = [
		"maximumExpandedBranches",
		"maximumQueuedBranches",
		"maximumTraceLength",
		"maximumAgendaDepth",
		"maximumExpandedStates",
		"maximumQueuedStates",
		"maximumRoutePlans",
		"engine-transitions",
		"strategy-invocations",
		"delegation-depth",
	];
	return (
		order.find((limit) => limits.has(limit)) ??
		[
			...limits,
		].sort(compareIds)[0]
	);
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
	readonly budgetLimits: ReadonlySet<string>;
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
	minimumCharges = 0,
	quantity = 1,
	runtime,
	solveSubgoalFx,
}: searchPlannerGoalFx.Props) {
	if (!Number.isSafeInteger(quantity) || quantity < 1)
		return yield* Effect.die(
			new RangeError(
				`Planner target quantity must be a positive safe integer, received ${quantity}.`,
			),
		);
	if (!Number.isSafeInteger(minimumCharges) || minimumCharges < 0)
		return yield* Effect.die(
			new RangeError(
				`Planner target minimum charges must be a non-negative safe integer, received ${minimumCharges}.`,
			),
		);

	const budget = readPlannerGoalSearchBudget(budgetOverride);
	const targetGoal: PlannerItemGoal = {
		itemId,
		minimumCharges,
		quantity,
	};
	const initialExecution = readInitialExecution(runtime);
	const initial: PlannerGoalBranch = {
		agenda: [
			readInitialResourceGoal(itemId, quantity, minimumCharges),
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
	const budgetLimits = new Set<string>();
	const delegatedReasons = new Set<PlannerStrategyInconclusiveReason>();
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
					solveSubgoalFx,
					targetGoal,
				}),
			{
				concurrency: budget.maximumConcurrentBranches,
			},
		);
		counters.expandedBranches += batch.length;
		const producedChildren: PlannerGoalBranch[] = [];
		const addFallback = (branch: PlannerGoalBranch) => {
			if (branch.fallback !== undefined) producedChildren.push(branch.fallback);
		};

		for (const result of expansions) {
			if (result.type === "budget") {
				budgetLimits.add(result.limit);
				counters.backtracks += 1;
				addFallback(result.branch);
				continue;
			}
			const expansion = result.expansion;
			if (expansion.attemptedActionId !== undefined) counters.attemptedActions += 1;
			if (expansion.delegatedSubgoal !== undefined) {
				const delegated = expansion.delegatedSubgoal;
				counters.delegatedSubgoals += 1;
				counters.delegatedExpandedNodes += delegated.metrics.expandedNodes;
				counters.delegatedVisitedNodes += delegated.metrics.visitedNodes;
				counters.delegatedMaximumFrontierSize = Math.max(
					counters.delegatedMaximumFrontierSize,
					delegated.metrics.frontierSize,
				);
				if (delegated.outcome === "completed") counters.delegatedCompletedSubgoals += 1;
				if (delegated.outcome === "no-finite-path")
					counters.delegatedNoFinitePathSubgoals += 1;
				if (delegated.outcome === "inconclusive")
					counters.delegatedInconclusiveSubgoals += 1;
				if (delegated.budgetLimit !== undefined) budgetLimits.add(delegated.budgetLimit);
				if (delegated.reason !== undefined) delegatedReasons.add(delegated.reason);
				for (const actionId of delegated.blockedActionIds) blockedActionIds.add(actionId);
				for (const actionId of delegated.unsupportedActionIds)
					unsupportedActionIds.add(actionId);
			}
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
			if (expansion.type === "unresolved") {
				counters.backtracks += 1;
				addFallback(result.branch);
				continue;
			}
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
				addFallback(result.branch);
				continue;
			}

			const pendingChildren = [
				...expansion.children,
			];
			for (let index = 0; index < pendingChildren.length; index += 1) {
				const child = pendingChildren[index];
				if (child === undefined) continue;
				counters.createdBranches += 1;
				counters.maximumAgendaDepth = Math.max(
					counters.maximumAgendaDepth,
					child.agenda.length,
				);
				if (child.agenda.length > budget.maximumAgendaDepth) {
					budgetLimits.add("maximumAgendaDepth");
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
					continue;
				}
				if (child.execution.trace.length > budget.maximumTraceLength) {
					budgetLimits.add("maximumTraceLength");
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
					continue;
				}
				const key = readBranchKey(child);
				if (visited.has(key)) {
					counters.duplicateBranches += 1;
					if (child.fallback !== undefined) pendingChildren.push(child.fallback);
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
				: delegatedReasons.has("non-quiescent-runtime")
					? "non-quiescent-runtime"
					: unsupportedActionIds.size > 0 ||
							delegatedReasons.has("action-unsupported") ||
							delegatedReasons.has("unsupported-routes")
						? "action-unsupported"
						: "search-exhausted",
		unsupportedActionIds,
	});
});
