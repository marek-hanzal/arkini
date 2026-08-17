import { Clock, Effect } from "effect";

import type { Planner } from "~/editor/planner/Planner";
import type { PlannerResult } from "~/editor/planner/PlannerResult";
import type { PlannerSearchDiagnostics } from "~/editor/planner/PlannerSearch";
import type {
	PlannerCoverageAuditItem,
	PlannerCoverageAuditReport,
} from "~/editor/planner/PlannerCoverageAudit";
import type { PlannerCoverageAuditRequest } from "~/editor/planner/PlannerCoverageAuditRequest";
import { readPlannerCoverageAuditSummaryFx } from "~/editor/planner/readPlannerCoverageAuditSummaryFx";
import { readPlannerSearchBudgetFx } from "~/editor/planner/readPlannerSearchBudgetFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace auditPlannerCoverageWithPlannerFx {
	export interface Props extends PlannerCoverageAuditRequest {
		readonly planner: Planner<"best-first", PlannerSearchDiagnostics>;
	}
}

type BestFirstPlannerResult = PlannerResult<"best-first", PlannerSearchDiagnostics>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const EmptyPlannerSearchDiagnostics: PlannerSearchDiagnostics = {
	attemptedRoutePlans: 0,
	routePlans: [],
};

const readBestFirstDiagnostics = (result: BestFirstPlannerResult) =>
	result.strategyDiagnostics ?? EmptyPlannerSearchDiagnostics;

const readPositiveInteger = (value: number | undefined, fallback: number) =>
	value === undefined || !Number.isFinite(value) ? fallback : Math.max(1, Math.floor(value));

const readElapsedMs = (startedAt: bigint, completedAt: bigint) =>
	Number(completedAt - startedAt) / 1_000_000;

const readUniqueDiagnosticActionIds = (
	result: BestFirstPlannerResult,
	key: "blockedActionIds" | "unsupportedActionIds",
) => {
	const routePlanIds = readBestFirstDiagnostics(result).routePlans.flatMap(
		(routePlan) => routePlan[key],
	);
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
}) => {
	const diagnostics = readBestFirstDiagnostics(result);
	return {
		blockedActionIds: readUniqueDiagnosticActionIds(result, "blockedActionIds"),
		expandedStates: result.strategyMetrics.expandedNodes,
		itemId,
		itemType,
		routePlanOutcomes: diagnostics.routePlans.map(({ outcome }) => outcome),
		routePlans: diagnostics.attemptedRoutePlans,
		searchDurationMs,
		title,
		unsupportedActionIds: readUniqueDiagnosticActionIds(result, "unsupportedActionIds"),
		visitedStates: result.strategyMetrics.visitedNodes,
		...(diagnostics.winningRoutePlanIndex === undefined
			? {}
			: {
					winningRoutePlanIndex: diagnostics.winningRoutePlanIndex,
				}),
	};
};

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
							budgetLimit: result.budgetLimit,
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

/** Audits bounded coverage with one reusable engine planner. */
export const auditPlannerCoverageWithPlannerFx: (
	props: auditPlannerCoverageWithPlannerFx.Props,
) => Effect.Effect<PlannerCoverageAuditReport> = Effect.fn("auditPlannerCoverageWithPlannerFx")(
	function* ({
		budget: inputBudget,
		config,
		itemIds,
		onProgress,
		planner,
		quantity: inputQuantity,
	}: auditPlannerCoverageWithPlannerFx.Props): Effect.fn.Return<PlannerCoverageAuditReport> {
		const budget = yield* readPlannerSearchBudgetFx(inputBudget);
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
			summary: yield* readPlannerCoverageAuditSummaryFx(items),
			version: 1,
		} satisfies PlannerCoverageAuditReport;
	},
);
