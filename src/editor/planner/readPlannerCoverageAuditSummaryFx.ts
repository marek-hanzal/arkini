import { Effect } from "effect";

import type {
	PlannerCoverageAuditFrequency,
	PlannerCoverageAuditItem,
	PlannerCoverageAuditItemTypeSummary,
	PlannerCoverageAuditRankedItem,
} from "~/editor/planner/PlannerCoverageAudit";
import { readPlannerCoverageAuditOutcomeCountsFx } from "~/editor/planner/readPlannerCoverageAuditOutcomeCountsFx";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const addFrequency = (frequencies: Map<string, number>, key: string) =>
	frequencies.set(key, (frequencies.get(key) ?? 0) + 1);

const readFrequencies = (
	frequencies: ReadonlyMap<string, number>,
	limit?: number,
): ReadonlyArray<PlannerCoverageAuditFrequency> =>
	[
		...frequencies.entries(),
	]
		.map(([key, count]) => ({
			count,
			key,
		}))
		.sort(
			({ count: leftCount, key: leftKey }, { count: rightCount, key: rightKey }) =>
				rightCount - leftCount || compareIds(leftKey, rightKey),
		)
		.slice(0, limit);

const readItemTypeSummary = (items: ReadonlyArray<PlannerCoverageAuditItem>) =>
	Effect.gen(function* () {
		const types = [
			...new Set(items.map(({ itemType }) => itemType)),
		].sort(compareIds);
		const summaries: PlannerCoverageAuditItemTypeSummary[] = [];
		for (const itemType of types) {
			const typeItems = items.filter((item) => item.itemType === itemType);
			summaries.push({
				itemType,
				outcomes: yield* readPlannerCoverageAuditOutcomeCountsFx(typeItems),
				totalItems: typeItems.length,
			});
		}
		return summaries;
	});

const readRankedItem = (item: PlannerCoverageAuditItem): PlannerCoverageAuditRankedItem => ({
	expandedStates: item.expandedStates,
	itemId: item.itemId,
	outcome: item.outcome,
	routePlans: item.routePlans,
	searchDurationMs: item.searchDurationMs,
	title: item.title,
	visitedStates: item.visitedStates,
	...(item.winningRoutePlanIndex === undefined
		? {}
		: {
				winningRoutePlanIndex: item.winningRoutePlanIndex,
			}),
});

const readPercentile = (values: ReadonlyArray<number>, percentile: number) => {
	if (values.length === 0) return 0;
	const index = Math.max(0, Math.ceil(values.length * percentile) - 1);
	return values[Math.min(index, values.length - 1)] ?? 0;
};

export const readPlannerCoverageAuditSummaryFx = Effect.fn("readPlannerCoverageAuditSummaryFx")(
	(items: ReadonlyArray<PlannerCoverageAuditItem>) =>
		Effect.gen(function* () {
			const budgetLimits = new Map<string, number>();
			const completedCertainties = new Map<string, number>();
			const inconclusiveReasons = new Map<string, number>();
			const routePlanOutcomes = new Map<string, number>();
			const blockedActions = new Map<string, number>();
			const unsupportedActions = new Map<string, number>();
			for (const item of items) {
				if (item.outcome === "completed")
					addFrequency(completedCertainties, item.outputCertainty);
				if (item.outcome === "inconclusive") {
					addFrequency(inconclusiveReasons, item.reason);
					if (item.budgetLimit !== undefined)
						addFrequency(budgetLimits, item.budgetLimit);
				}
				for (const outcome of item.routePlanOutcomes)
					addFrequency(routePlanOutcomes, outcome);
				for (const actionId of item.blockedActionIds)
					addFrequency(blockedActions, actionId);
				for (const actionId of item.unsupportedActionIds)
					addFrequency(unsupportedActions, actionId);
			}
			const durations = items
				.map(({ searchDurationMs }) => searchDurationMs)
				.sort((a, b) => a - b);
			const totalDurationMs = durations.reduce((total, duration) => total + duration, 0);
			const slowestItems = [
				...items,
			]
				.sort(
					(left, right) =>
						right.searchDurationMs - left.searchDurationMs ||
						compareIds(left.itemId, right.itemId),
				)
				.slice(0, 10)
				.map(readRankedItem);
			const largestSearches = [
				...items,
			]
				.sort(
					(left, right) =>
						right.expandedStates - left.expandedStates ||
						right.visitedStates - left.visitedStates ||
						right.routePlans - left.routePlans ||
						right.searchDurationMs - left.searchDurationMs ||
						compareIds(left.itemId, right.itemId),
				)
				.slice(0, 10)
				.map(readRankedItem);
			const itemTypes = yield* readItemTypeSummary(items);
			const outcomes = yield* readPlannerCoverageAuditOutcomeCountsFx(items);

			return {
				budgetLimits: readFrequencies(budgetLimits),
				completedCertainties: readFrequencies(completedCertainties),
				inconclusiveReasons: readFrequencies(inconclusiveReasons),
				itemTypes,
				largestSearches,
				latency: {
					maximumMs: durations.at(-1) ?? 0,
					meanMs: items.length === 0 ? 0 : totalDurationMs / items.length,
					medianMs: readPercentile(durations, 0.5),
					p95Ms: readPercentile(durations, 0.95),
					totalMs: totalDurationMs,
				},
				outcomes,
				routePlanOutcomes: readFrequencies(routePlanOutcomes),
				search: {
					expandedStates: items.reduce((total, item) => total + item.expandedStates, 0),
					routePlans: items.reduce((total, item) => total + item.routePlans, 0),
					visitedStates: items.reduce((total, item) => total + item.visitedStates, 0),
				},
				slowestItems,
				topBlockedActions: readFrequencies(blockedActions, 10),
				topUnsupportedActions: readFrequencies(unsupportedActions, 10),
				totalItems: items.length,
			};
		}),
);
