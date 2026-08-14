import { Clock, Effect } from "effect";

import type { Planner } from "~/editor/planner/Planner";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type {
	PlannerSearchBudget,
	PlannerSearchBudgetLimit,
	PlannerSearchDiagnostics,
} from "~/editor/planner/PlannerSearch";
import type {
	PlannerCoverageAuditFrequency,
	PlannerCoverageAuditItem,
	PlannerCoverageAuditItemTypeSummary,
	PlannerCoverageAuditOutcome,
	PlannerCoverageAuditRankedItem,
	PlannerCoverageAuditReport,
} from "~/editor/planner/PlannerCoverageAudit";
import { createBestFirstPlannerStrategy } from "~/editor/planner/createBestFirstPlannerStrategy";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { readPlannerSearchBudget } from "~/editor/planner/readPlannerSearchBudget";
import { readPlannerCoverageAuditOutcomeCounts } from "~/editor/planner/readPlannerCoverageAuditOutcomeCounts";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface PlannerCoverageAuditProgress {
	readonly index: number;
	readonly itemId: IdSchema.Type;
	readonly outcome: PlannerCoverageAuditOutcome;
	readonly searchDurationMs: number;
	readonly title: string;
	readonly total: number;
}

export namespace auditPlannerCoverageFx {
	export interface Props {
		readonly budget?: Partial<PlannerSearchBudget>;
		readonly config: GameConfigSchema.Type;
		readonly itemIds?: ReadonlyArray<IdSchema.Type>;
		readonly onProgress?: (progress: PlannerCoverageAuditProgress) => Effect.Effect<void>;
		readonly quantity?: number;
	}
}

export namespace auditPlannerCoverageWithPlannerFx {
	export interface Props extends auditPlannerCoverageFx.Props {
		readonly planner: Planner<"best-first", PlannerSearchBudget, PlannerSearchDiagnostics>;
	}
}

type BestFirstPlannerResult = PlannerResult<"best-first", PlannerSearchDiagnostics>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readPositiveInteger = (value: number | undefined, fallback: number) =>
	value === undefined || !Number.isFinite(value) ? fallback : Math.max(1, Math.floor(value));

const readElapsedMs = (startedAt: bigint, completedAt: bigint) =>
	Number(completedAt - startedAt) / 1_000_000;

const readUniqueDiagnosticActionIds = (
	result: BestFirstPlannerResult,
	key: "blockedActionIds" | "unsupportedActionIds",
) => {
	const routePlanIds = result.strategyDiagnostics.routePlans.flatMap((routePlan) => routePlan[key]);
	const finalIds = result.type === "inconclusive" ? result[key] : [];
	return [
		...new Set([
			...routePlanIds,
			...finalIds,
		]),
	].sort(compareIds);
};

const readCommonItem = ({
	itemId,
	itemType,
	result,
	searchDurationMs,
	title,
}: {
	readonly itemId: IdSchema.Type;
	readonly itemType: GameConfigSchema.Type["items"][string]["type"];
	readonly result: BestFirstPlannerResult;
	readonly searchDurationMs: number;
	readonly title: string;
}) => ({
	blockedActionIds: readUniqueDiagnosticActionIds(result, "blockedActionIds"),
	expandedStates: result.strategyMetrics.expandedNodes,
	itemId,
	itemType,
	routePlanOutcomes: result.strategyDiagnostics.routePlans.map(({ outcome }) => outcome),
	routePlans: result.strategyDiagnostics.attemptedRoutePlans,
	searchDurationMs,
	title,
	unsupportedActionIds: readUniqueDiagnosticActionIds(result, "unsupportedActionIds"),
	visitedStates: result.strategyMetrics.visitedNodes,
	...(result.strategyDiagnostics.winningRoutePlanIndex === undefined
		? {}
		: {
				winningRoutePlanIndex: result.strategyDiagnostics.winningRoutePlanIndex,
			}),
});

const readAuditItem = ({
	itemId,
	itemType,
	result,
	searchDurationMs,
	title,
}: {
	readonly itemId: IdSchema.Type;
	readonly itemType: GameConfigSchema.Type["items"][string]["type"];
	readonly result: BestFirstPlannerResult;
	readonly searchDurationMs: number;
	readonly title: string;
}): PlannerCoverageAuditItem => {
	const common = readCommonItem({
		itemId,
		itemType,
		result,
		searchDurationMs,
		title,
	});
	switch (result.type) {
		case "completed":
			return {
				...common,
				authoredElapsedMs: result.execution.elapsedMs,
				expectedActionRuns: result.economics.expectedActionRuns,
				expectedElapsedMs: result.economics.expectedElapsedMs,
				outcome: "completed",
				outputCertainty: result.execution.outputCertainty,
				selectedWitnessProbability: result.execution.selectedWitnessProbability,
				traceLength: result.execution.trace.length,
			};
		case "inconclusive":
			return {
				...common,
				bestAvailableQuantity: result.bestAvailableQuantity,
				...(result.budgetLimit === undefined
					? {}
					: {
							budgetLimit: result.budgetLimit as PlannerSearchBudgetLimit,
						}),
				frontierSize: result.strategyMetrics.frontierSize,
				outcome: "inconclusive",
				reason: result.reason,
				traceLength: result.strategyMetrics.traceLength,
			};
		case "no-finite-path":
			return {
				...common,
				blockedRouteCount:
					result.proof.type === "no-finite-path" ? result.proof.blockedRoutes.length : 0,
				cycleComponentIds:
					result.proof.type === "no-finite-path" ? result.proof.cycleComponentIds : [],
				outcome: "no-finite-path",
				proofType: result.proof.type,
				sourceLessItemIds:
					result.proof.type === "no-finite-path" ? result.proof.sourceLessItemIds : [],
			};
	}
};

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

const readItemTypeSummary = (
	items: ReadonlyArray<PlannerCoverageAuditItem>,
): ReadonlyArray<PlannerCoverageAuditItemTypeSummary> => {
	const types = [
		...new Set(items.map(({ itemType }) => itemType)),
	].sort(compareIds);
	return types.map((itemType) => {
		const typeItems = items.filter((item) => item.itemType === itemType);
		return {
			itemType,
			outcomes: readPlannerCoverageAuditOutcomeCounts(typeItems),
			totalItems: typeItems.length,
		};
	});
};

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

export const readPlannerCoverageAuditSummary = (
	items: ReadonlyArray<PlannerCoverageAuditItem>,
): PlannerCoverageAuditReport["summary"] => {
	const budgetLimits = new Map<string, number>();
	const completedCertainties = new Map<string, number>();
	const inconclusiveReasons = new Map<string, number>();
	const routePlanOutcomes = new Map<string, number>();
	const blockedActions = new Map<string, number>();
	const unsupportedActions = new Map<string, number>();
	for (const item of items) {
		if (item.outcome === "completed") addFrequency(completedCertainties, item.outputCertainty);
		if (item.outcome === "inconclusive") {
			addFrequency(inconclusiveReasons, item.reason);
			if (item.budgetLimit !== undefined) addFrequency(budgetLimits, item.budgetLimit);
		}
		for (const outcome of item.routePlanOutcomes) addFrequency(routePlanOutcomes, outcome);
		for (const actionId of item.blockedActionIds) addFrequency(blockedActions, actionId);
		for (const actionId of item.unsupportedActionIds)
			addFrequency(unsupportedActions, actionId);
	}
	const durations = items.map(({ searchDurationMs }) => searchDurationMs).sort((a, b) => a - b);
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
	return {
		budgetLimits: readFrequencies(budgetLimits),
		completedCertainties: readFrequencies(completedCertainties),
		inconclusiveReasons: readFrequencies(inconclusiveReasons),
		itemTypes: readItemTypeSummary(items),
		largestSearches,
		latency: {
			maximumMs: durations.at(-1) ?? 0,
			meanMs: items.length === 0 ? 0 : totalDurationMs / items.length,
			medianMs: readPercentile(durations, 0.5),
			p95Ms: readPercentile(durations, 0.95),
			totalMs: totalDurationMs,
		},
		outcomes: readPlannerCoverageAuditOutcomeCounts(items),
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
};

/** Audits bounded coverage with one reusable engine planner. */
export const auditPlannerCoverageWithPlannerFx = Effect.fn("auditPlannerCoverageWithPlannerFx")(
	function* ({
		budget: inputBudget,
		config,
		itemIds,
		onProgress,
		planner,
		quantity: inputQuantity,
	}: auditPlannerCoverageWithPlannerFx.Props) {
		const budget = readPlannerSearchBudget(inputBudget);
		const quantity = readPositiveInteger(inputQuantity, 1);
		const selectedItemIds = (itemIds ?? Object.keys(config.items))
			.filter((itemId): itemId is IdSchema.Type => config.items[itemId] !== undefined)
			.filter((itemId, index, all) => all.indexOf(itemId) === index)
			.sort(compareIds);
		const items: PlannerCoverageAuditItem[] = [];
		for (const [index, itemId] of selectedItemIds.entries()) {
			const item = config.items[itemId];
			if (item === undefined) continue;
			const startedAt = yield* Clock.currentTimeNanos;
			const result = yield* planner.estimateFx({
				budget,
				itemId,
				quantity,
			});
			const completedAt = yield* Clock.currentTimeNanos;
			const searchDurationMs = readElapsedMs(startedAt, completedAt);
			const auditItem = readAuditItem({
				itemId,
				itemType: item.type,
				result,
				searchDurationMs,
				title: item.title,
			});
			items.push(auditItem);
			if (onProgress !== undefined)
				yield* onProgress({
					index: index + 1,
					itemId,
					outcome: auditItem.outcome,
					searchDurationMs,
					title: item.title,
					total: selectedItemIds.length,
				});
		}
		return {
			budget,
			items,
			quantity,
			summary: readPlannerCoverageAuditSummary(items),
			version: 1,
		} satisfies PlannerCoverageAuditReport;
	},
);

/** Audits bounded engine-planner coverage over one immutable game configuration. */
export const auditPlannerCoverageFx = Effect.fn("auditPlannerCoverageFx")(
	(props: auditPlannerCoverageFx.Props) =>
		Effect.gen(function* () {
			const planner = yield* createPlannerFx({
				config: props.config,
				createStrategy: ({ config, graph }) =>
					createBestFirstPlannerStrategy({
						config,
						graph,
					}),
			});
			return yield* auditPlannerCoverageWithPlannerFx({
				...props,
				planner,
			});
		}),
);
