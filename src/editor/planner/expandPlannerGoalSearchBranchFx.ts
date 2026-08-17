import { Effect } from "effect";

import type { PlannerBudgetExceeded } from "~/editor/planner/PlannerBudget";
import type { PlannerBudgetFx } from "~/editor/planner/PlannerBudgetFx";
import type { PlannerGoalSearchSubgoalSolver } from "~/editor/planner/PlannerGoalSearch";
import type { PlannerItemGoal } from "~/editor/planner/PlannerGoalViability";
import type { PlannerRequirementDemand } from "~/editor/planner/PlannerRequirementDemand";
import { addPlannerRequirementDemandFx } from "~/editor/planner/addPlannerRequirementDemandFx";
import { isPlannerAcquisitionRouteReadyFx } from "~/editor/planner/isPlannerAcquisitionRouteReadyFx";
import { readPlannerRequirementSourcePriorityFx } from "~/editor/planner/readPlannerRequirementSourcePriorityFx";
import type { PlannerSearchExecutionState } from "~/editor/planner/PlannerSearchExecution";
import type { PlannerSearchAction } from "~/editor/planner/PlannerSearchScope";
import type { PlannerStrategyInconclusiveReason } from "~/editor/planner/PlannerStrategy";
import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { composePlannerSearchExecutionFx } from "~/editor/planner/composePlannerSearchExecutionFx";
import { isPlannerRuntimeQuiescentFx } from "~/editor/planner/isPlannerRuntimeQuiescentFx";
import { readPlannerGoalAgendaViabilityFx } from "~/editor/planner/readPlannerGoalAgendaViabilityFx";
import { readPlannerGoalViabilityFx } from "~/editor/planner/readPlannerGoalViabilityFx";
import { readPlannerItemGoalStatusFx } from "~/editor/planner/readPlannerItemGoalStatusFx";
import { readPlannerSearchActionsFx } from "~/editor/planner/readPlannerSearchActionsFx";
import { runPlannerSearchCandidateFx } from "~/editor/planner/runPlannerSearchCandidateFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace expandPlannerGoalSearchBranchFx {
	export interface ResourceGoalTask {
		readonly itemId: IdSchema.Type;
		readonly minimumCharges: number;
		readonly minimumQuantity: number;
		readonly resolution: "local" | "subgoal";
		readonly type: "resource";
	}

	export interface RouteTask {
		readonly candidate: PlannerSearchAction;
		readonly route: PlannerAcquisitionRoute;
		readonly type: "route";
	}

	export type Task = ResourceGoalTask | RouteTask;

	export interface Branch {
		readonly agenda: ReadonlyArray<Task>;
		readonly choicePath: ReadonlyArray<number>;
		readonly execution: PlannerSearchExecutionState;
		readonly fallback?: Branch;
	}

	export interface DelegatedSubgoalSummary {
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

	export type Result = {
		readonly attemptedActionId?: string;
		readonly delegatedSubgoal?: DelegatedSubgoalSummary;
	} & (
		| {
				readonly branch: Branch;
				readonly type: "completed";
		  }
		| {
				readonly actionId?: string;
				readonly reason: "blocked" | "dead-end" | "unsupported";
				readonly type: "dead";
		  }
		| {
				readonly children: ReadonlyArray<Branch>;
				readonly type: "expanded";
		  }
		| {
				readonly branch: Branch;
				readonly type: "non-quiescent";
		  }
		| {
				readonly branch: Branch;
				readonly type: "unresolved";
		  }
	);

	export interface Props {
		readonly branch: Branch;
		readonly graph: PlannerAcquisitionGraph;
		readonly solveSubgoalFx?: PlannerGoalSearchSubgoalSolver;
		readonly targetGoal: PlannerItemGoal;
	}
}

interface PlannerRequirementChoice {
	readonly goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask;
	readonly key: string;
	readonly sourcePriority: number;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readRuntimeItemFacts = (runtime: RuntimeSchema.Type, itemId: IdSchema.Type) => {
	let chargeCapacity = 0;
	let quantity = 0;
	for (const item of runtime.items) {
		if (item.item.id !== itemId) continue;
		quantity += item.quantity;
		const fullCapacity = item.item.charges?.amount;
		if (fullCapacity !== undefined)
			chargeCapacity += (item.remainingCharges ?? fullCapacity) * item.quantity;
	}
	return {
		chargeCapacity,
		quantity,
	};
};
const isResourceGoalSatisfied = (
	goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask,
	runtime: RuntimeSchema.Type,
) => {
	const facts = readRuntimeItemFacts(runtime, goal.itemId);
	return facts.quantity >= goal.minimumQuantity && facts.chargeCapacity >= goal.minimumCharges;
};

const isTargetGoalSatisfied = (goal: PlannerItemGoal, runtime: RuntimeSchema.Type) => {
	const facts = readRuntimeItemFacts(runtime, goal.itemId);
	return facts.quantity >= goal.quantity && facts.chargeCapacity >= (goal.minimumCharges ?? 0);
};

const projectResourceGoal = (
	goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask,
): PlannerItemGoal => ({
	itemId: goal.itemId,
	minimumCharges: goal.minimumCharges,
	quantity: Math.max(1, goal.minimumQuantity),
});

const readAgendaItemGoals = (
	targetGoal: PlannerItemGoal,
	agenda: ReadonlyArray<expandPlannerGoalSearchBranchFx.Task>,
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

const readRequirementGoal = (
	requirement: PlannerAcquisitionRequirement,
): expandPlannerGoalSearchBranchFx.ResourceGoalTask => ({
	itemId: requirement.itemId,
	minimumCharges: requirement.usage === "charge" ? (requirement.chargeCost ?? 0) : 0,
	minimumQuantity: requirement.minimumQuantity,
	resolution: "subgoal",
	type: "resource",
});

const readAllOfRequirementChoicesFx = Effect.fn("searchPlannerGoalFx.allOfRequirementChoices")(
	function* (route: PlannerAcquisitionRoute, runtime: RuntimeSchema.Type) {
		const demandByItemId = new Map<IdSchema.Type, PlannerRequirementDemand>();
		for (const requirement of route.requirements.allOf)
			yield* addPlannerRequirementDemandFx(demandByItemId, requirement);
		return [
			...demandByItemId,
		].flatMap(([itemId, demand]) => {
			const goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask = {
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
	},
);

const readAnyOfRequirementChoiceGroupsFx = Effect.fn(
	"searchPlannerGoalFx.anyOfRequirementChoiceGroups",
)(function* (route: PlannerAcquisitionRoute, runtime: RuntimeSchema.Type) {
	const groups: Array<ReadonlyArray<PlannerRequirementChoice>> = [];
	for (const [clauseIndex, clause] of route.requirements.anyOf.entries()) {
		if (
			clause.some((requirement) =>
				isResourceGoalSatisfied(readRequirementGoal(requirement), runtime),
			)
		)
			continue;
		groups.push(
			yield* Effect.forEach(clause, (requirement, alternativeIndex) =>
				readPlannerRequirementSourcePriorityFx(requirement.source).pipe(
					Effect.map((sourcePriority) => ({
						goal: readRequirementGoal(requirement),
						key: JSON.stringify([
							"any-of",
							route.id,
							clauseIndex,
							alternativeIndex,
						]),
						sourcePriority,
					})),
				),
			),
		);
	}
	return groups;
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

const readUnmetRequirementChoicesFx = Effect.fn("searchPlannerGoalFx.unmetRequirementChoices")(
	function* ({
		graph,
		route,
		runtime,
	}: {
		readonly graph: PlannerAcquisitionGraph;
		readonly route: PlannerAcquisitionRoute;
		readonly runtime: RuntimeSchema.Type;
	}) {
		const mandatory = deduplicateRequirementChoices(
			[
				...(yield* readAllOfRequirementChoicesFx(route, runtime)),
			].sort((left, right) => compareRequirementChoices(graph, left, right)),
		);
		if (mandatory.length > 0)
			return {
				choices: mandatory,
				type: "mandatory" as const,
			};

		const alternativeGroups = (yield* readAnyOfRequirementChoiceGroupsFx(route, runtime))
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
	},
);

const compareRoutes = (
	graph: PlannerAcquisitionGraph,
	left: {
		readonly ready: boolean;
		readonly route: PlannerAcquisitionRoute;
	},
	right: {
		readonly ready: boolean;
		readonly route: PlannerAcquisitionRoute;
	},
) =>
	Number(right.ready) - Number(left.ready) ||
	(graph.routeDepthById.get(left.route.id) ?? Number.POSITIVE_INFINITY) -
		(graph.routeDepthById.get(right.route.id) ?? Number.POSITIVE_INFINITY) ||
	compareIds(left.route.id, right.route.id);

const readResourceRouteBranchesFx = Effect.fn("readResourceRouteBranchesFx")(function* ({
	branch,
	goal,
	graph,
	rest,
}: {
	readonly branch: expandPlannerGoalSearchBranchFx.Branch;
	readonly goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask;
	readonly graph: PlannerAcquisitionGraph;
	readonly rest: ReadonlyArray<expandPlannerGoalSearchBranchFx.Task>;
}) {
	const routeCandidates = yield* Effect.forEach(
		(graph.routesByOutputItemId.get(goal.itemId) ?? []).filter(
			(route) => route.output.maximumQuantity > 0,
		),
		(route) =>
			isPlannerAcquisitionRouteReadyFx(route, branch.execution.runtime).pipe(
				Effect.map((ready) => ({
					ready,
					route,
				})),
			),
	);
	const routes = routeCandidates
		.sort((left, right) => compareRoutes(graph, left, right))
		.map(({ route }) => route);
	const optionGroups = yield* Effect.forEach(routes, (route) =>
		readPlannerSearchActionsFx({
			graph,
			routes: [
				route,
			],
		}).pipe(
			Effect.map((actions) =>
				actions.map((candidate) => ({
					candidate,
					route,
				})),
			),
		),
	);
	const options = optionGroups.flat();
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
});
const appendChoice = (
	branch: expandPlannerGoalSearchBranchFx.Branch,
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
	readonly goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask;
	readonly rest: ReadonlyArray<expandPlannerGoalSearchBranchFx.Task>;
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
	readonly branch: expandPlannerGoalSearchBranchFx.Branch;
	readonly goal: expandPlannerGoalSearchBranchFx.ResourceGoalTask;
	readonly graph: PlannerAcquisitionGraph;
	readonly rest: ReadonlyArray<expandPlannerGoalSearchBranchFx.Task>;
	readonly solveSubgoalFx: PlannerGoalSearchSubgoalSolver;
	readonly targetGoal: PlannerItemGoal;
}): Effect.fn.Return<expandPlannerGoalSearchBranchFx.Result, PlannerBudgetExceeded> {
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
	const summary: expandPlannerGoalSearchBranchFx.DelegatedSubgoalSummary = {
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

	const status = yield* readPlannerItemGoalStatusFx(
		projectResourceGoal(goal),
		result.execution.runtime,
	);
	if (!status.satisfied)
		return yield* Effect.die(
			new Error(
				`Delegated planner subgoal ${goal.itemId} completed with ${status.availableQuantity}/${goal.minimumQuantity} items and ${status.availableCharges}/${goal.minimumCharges} charges.`,
			),
		);
	if (!(yield* isPlannerRuntimeQuiescentFx(result.execution.runtime)))
		return yield* Effect.die(
			new Error(`Delegated planner subgoal ${goal.itemId} returned a non-quiescent runtime.`),
		);

	const execution = yield* composePlannerSearchExecutionFx(branch.execution, result.execution);
	const agendaViability = yield* readPlannerGoalAgendaViabilityFx({
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
	readonly branch: expandPlannerGoalSearchBranchFx.Branch;
	readonly choices: ReadonlyArray<PlannerRequirementChoice>;
	readonly rest: ReadonlyArray<expandPlannerGoalSearchBranchFx.Task>;
	readonly task: expandPlannerGoalSearchBranchFx.RouteTask;
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

export const expandPlannerGoalSearchBranchFx = Effect.fn("expandPlannerGoalSearchBranchFx")(
	function* ({
		branch,
		graph,
		solveSubgoalFx,
		targetGoal,
	}: expandPlannerGoalSearchBranchFx.Props): Effect.fn.Return<
		expandPlannerGoalSearchBranchFx.Result,
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

			const viability = yield* readPlannerGoalViabilityFx({
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

			const children = yield* readResourceRouteBranchesFx({
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

		const requirementChoice = yield* readUnmetRequirementChoicesFx({
			graph,
			route: task.route,
			runtime: branch.execution.runtime,
		});
		if (
			!(yield* isPlannerAcquisitionRouteReadyFx(task.route, branch.execution.runtime)) &&
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
		if (!(yield* isPlannerRuntimeQuiescentFx(transition.state.runtime)))
			return {
				attemptedActionId: task.candidate.id,
				branch: {
					...branch,
					execution: transition.state,
				},
				type: "non-quiescent",
			};

		const agendaViability = yield* readPlannerGoalAgendaViabilityFx({
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
	},
);
