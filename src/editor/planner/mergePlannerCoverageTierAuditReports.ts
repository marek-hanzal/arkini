import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type { PlannerCoverageAuditItem } from "~/editor/planner/PlannerCoverageAudit";
import {
	PlannerCoverageTierAuditInputError,
	type PlannerCoverageTierAuditItem,
	type PlannerCoverageTierAuditReport,
	type PlannerCoverageTierAuditTier,
} from "~/editor/planner/PlannerCoverageTierAudit";
import { readPlannerCoverageAuditSummary } from "~/editor/planner/auditPlannerCoverageFx";
import { readPlannerCoverageAuditOutcomeCounts } from "~/editor/planner/readPlannerCoverageAuditOutcomeCounts";

const BudgetKeys = [
	"maximumExpandedStates",
	"maximumQueuedStates",
	"maximumRoutePlans",
	"maximumTraceLength",
] as const satisfies ReadonlyArray<keyof PlannerSearchBudget>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const fail = (message: string): never => {
	throw new PlannerCoverageTierAuditInputError({
		message,
	});
};

const assertSameBudget = ({
	actual,
	expected,
	tierId,
}: {
	readonly actual: PlannerSearchBudget;
	readonly expected: PlannerSearchBudget;
	readonly tierId: string;
}) => {
	for (const key of BudgetKeys)
		if (actual[key] !== expected[key])
			fail(
				`Planner coverage shard tier ${tierId} has ${key}=${actual[key]}, expected ${expected[key]}.`,
			);
};

const normalizeItem = (item: PlannerCoverageTierAuditItem): PlannerCoverageTierAuditItem => {
	if (item.attempts.length === 0)
		return fail(`Planner coverage shard item has no attempts: ${item.itemId}.`);
	let previousTierIndex = 0;
	for (const attempt of item.attempts) {
		if (attempt.result.itemId !== item.itemId)
			return fail(
				`Planner coverage shard item ${item.itemId} contains an attempt for ${attempt.result.itemId}.`,
			);
		if (attempt.tierIndex <= previousTierIndex)
			return fail(
				`Planner coverage shard item tiers are not strictly increasing: ${item.itemId}.`,
			);
		previousTierIndex = attempt.tierIndex;
	}
	const finalAttempt = item.attempts.at(-1);
	if (finalAttempt === undefined)
		return fail(`Planner coverage shard item has no final attempt: ${item.itemId}.`);
	const resolvedAttempt = item.attempts.find(({ result }) => result.outcome !== "inconclusive");
	if (
		resolvedAttempt !== undefined &&
		item.attempts.some(({ tierIndex }) => tierIndex > resolvedAttempt.tierIndex)
	)
		return fail(`Planner coverage shard item was retried after resolution: ${item.itemId}.`);
	return {
		attempts: item.attempts,
		finalOutcome: finalAttempt.result.outcome,
		itemId: item.itemId,
		itemType: item.itemType,
		...(resolvedAttempt === undefined
			? {}
			: {
					resolvedTierId: resolvedAttempt.tierId,
					resolvedTierIndex: resolvedAttempt.tierIndex,
				}),
		title: item.title,
	};
};

const readAttemptAtTier = (item: PlannerCoverageTierAuditItem, tierIndex: number) =>
	item.attempts.find((attempt) => attempt.tierIndex === tierIndex);

const readResultAtOrBeforeTier = (
	item: PlannerCoverageTierAuditItem,
	tierIndex: number,
): PlannerCoverageAuditItem | undefined => {
	let result: PlannerCoverageAuditItem | undefined;
	for (const attempt of item.attempts) {
		if (attempt.tierIndex > tierIndex) break;
		result = attempt.result;
	}
	return result;
};

const readTierReports = ({
	items,
	template,
}: {
	readonly items: ReadonlyArray<PlannerCoverageTierAuditItem>;
	readonly template: PlannerCoverageTierAuditReport;
}): ReadonlyArray<PlannerCoverageTierAuditTier> =>
	template.tiers.map((tier) => {
		const attemptedResults = items.flatMap((item) => {
			const attempt = readAttemptAtTier(item, tier.index);
			return attempt === undefined
				? []
				: [
						attempt.result,
					];
		});
		const previousResults = items.flatMap((item) => {
			const result = readResultAtOrBeforeTier(item, tier.index - 1);
			return result === undefined
				? []
				: [
						result,
					];
		});
		const cumulativeResults = items.flatMap((item) => {
			const result = readResultAtOrBeforeTier(item, tier.index);
			return result === undefined
				? []
				: [
						result,
					];
		});
		const attemptSummary = readPlannerCoverageAuditSummary(attemptedResults);
		const cumulativeOutcomes = readPlannerCoverageAuditOutcomeCounts(cumulativeResults);
		const newlyCompleted = attemptSummary.outcomes.completed;
		const newlyNoFinitePath = attemptSummary.outcomes.noFinitePath;
		const newlyResolved = newlyCompleted + newlyNoFinitePath;
		return {
			attemptSummary,
			attemptedItems: attemptedResults.length,
			budget: tier.budget,
			carriedCompleted: previousResults.filter(({ outcome }) => outcome === "completed")
				.length,
			carriedNoFinitePath: previousResults.filter(
				({ outcome }) => outcome === "no-finite-path",
			).length,
			cumulativeOutcomes,
			id: tier.id,
			index: tier.index,
			marginalResolutionRate:
				attemptedResults.length === 0 ? 0 : newlyResolved / attemptedResults.length,
			newlyCompleted,
			newlyNoFinitePath,
			remainingInconclusive: cumulativeOutcomes.inconclusive,
			resolutionRate:
				items.length === 0
					? 1
					: (cumulativeOutcomes.completed + cumulativeOutcomes.noFinitePath) /
						items.length,
		};
	});

const assertCompatibleReports = (
	template: PlannerCoverageTierAuditReport,
	report: PlannerCoverageTierAuditReport,
) => {
	if (report.version !== template.version)
		fail(
			`Planner coverage shard version mismatch: ${report.version} versus ${template.version}.`,
		);
	if (report.quantity !== template.quantity)
		fail(
			`Planner coverage shard quantity mismatch: ${report.quantity} versus ${template.quantity}.`,
		);
	if (report.tiers.length !== template.tiers.length)
		fail(
			`Planner coverage shard tier count mismatch: ${report.tiers.length} versus ${template.tiers.length}.`,
		);
	for (const [index, expected] of template.tiers.entries()) {
		const actual = report.tiers[index];
		if (actual === undefined) fail(`Planner coverage shard is missing tier ${expected.id}.`);
		if (actual.id !== expected.id || actual.index !== expected.index)
			fail(
				`Planner coverage shard tier mismatch at index ${index + 1}: ${actual.id} versus ${expected.id}.`,
			);
		assertSameBudget({
			actual: actual.budget,
			expected: expected.budget,
			tierId: expected.id,
		});
	}
};

/** Merges disjoint tier-audit shards and recomputes every aggregate from item attempts. */
export const mergePlannerCoverageTierAuditReports = (
	reports: ReadonlyArray<PlannerCoverageTierAuditReport>,
): PlannerCoverageTierAuditReport => {
	const template = reports[0];
	if (template === undefined)
		return fail("Planner coverage tier merge requires at least one report.");
	const itemById = new Map<string, PlannerCoverageTierAuditItem>();
	for (const report of reports) {
		assertCompatibleReports(template, report);
		for (const sourceItem of report.items) {
			const item = normalizeItem(sourceItem);
			if (item.attempts[0]?.tierIndex !== 1)
				return fail(
					`Planner coverage shard item does not start at tier 1: ${item.itemId}.`,
				);
			for (const attempt of item.attempts) {
				const tier = template.tiers[attempt.tierIndex - 1];
				if (tier === undefined || tier.id !== attempt.tierId)
					return fail(
						`Planner coverage shard item ${item.itemId} references unknown tier ${attempt.tierId}.`,
					);
			}
			if (itemById.has(item.itemId))
				return fail(`Planner coverage shard item is duplicated: ${item.itemId}.`);
			itemById.set(item.itemId, item);
		}
	}
	const items = [
		...itemById.values(),
	].sort((left, right) => compareIds(left.itemId, right.itemId));
	const tiers = readTierReports({
		items,
		template,
	});
	const finalResults = items.map(({ attempts }) => {
		const attempt = attempts.at(-1);
		if (attempt === undefined)
			return fail("Planner coverage shard item unexpectedly lost its final attempt.");
		return attempt.result;
	});
	const finalOutcomes = readPlannerCoverageAuditOutcomeCounts(finalResults);
	const saturatedTier = tiers.find(({ remainingInconclusive }) => remainingInconclusive === 0);
	return {
		items,
		quantity: template.quantity,
		summary: {
			finalOutcomes,
			resolutionByTier: tiers.map(({ id, index, newlyCompleted, newlyNoFinitePath }) => ({
				count: newlyCompleted + newlyNoFinitePath,
				tierId: id,
				tierIndex: index,
			})),
			...(saturatedTier === undefined
				? {}
				: {
						saturatedTierId: saturatedTier.id,
						saturatedTierIndex: saturatedTier.index,
					}),
			search: {
				expandedStates: tiers.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.expandedStates,
					0,
				),
				routePlans: tiers.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.routePlans,
					0,
				),
				visitedStates: tiers.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.visitedStates,
					0,
				),
			},
			tierCount: tiers.length,
			totalItems: items.length,
			totalSearchAttempts: tiers.reduce(
				(total, { attemptedItems }) => total + attemptedItems,
				0,
			),
			totalSearchDurationMs: tiers.reduce(
				(total, { attemptSummary }) => total + attemptSummary.latency.totalMs,
				0,
			),
			unresolvedItemIds: items
				.filter(({ finalOutcome }) => finalOutcome === "inconclusive")
				.map(({ itemId }) => itemId),
		},
		tiers,
		version: 1,
	};
};
