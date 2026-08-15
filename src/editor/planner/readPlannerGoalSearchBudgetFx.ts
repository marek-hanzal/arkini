import { Effect } from "effect";

import {
	DefaultPlannerGoalSearchBudget,
	type PlannerGoalSearchBudget,
} from "~/editor/planner/PlannerGoalSearch";

const readPositiveInteger = (candidate: number | undefined, fallback: number) =>
	candidate === undefined || !Number.isFinite(candidate)
		? fallback
		: Math.max(1, Math.floor(candidate));

export const readPlannerGoalSearchBudgetFx = Effect.fn("readPlannerGoalSearchBudgetFx")(
	(budget?: Partial<PlannerGoalSearchBudget>) =>
		Effect.sync(() => ({
			maximumAgendaDepth: readPositiveInteger(
				budget?.maximumAgendaDepth,
				DefaultPlannerGoalSearchBudget.maximumAgendaDepth,
			),
			maximumConcurrentBranches: readPositiveInteger(
				budget?.maximumConcurrentBranches,
				DefaultPlannerGoalSearchBudget.maximumConcurrentBranches,
			),
			maximumExpandedBranches: readPositiveInteger(
				budget?.maximumExpandedBranches,
				DefaultPlannerGoalSearchBudget.maximumExpandedBranches,
			),
			maximumQueuedBranches: readPositiveInteger(
				budget?.maximumQueuedBranches,
				DefaultPlannerGoalSearchBudget.maximumQueuedBranches,
			),
			maximumTraceLength: readPositiveInteger(
				budget?.maximumTraceLength,
				DefaultPlannerGoalSearchBudget.maximumTraceLength,
			),
		})),
);
