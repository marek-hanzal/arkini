import { Effect } from "effect";

import type { PlannerSearchBudget } from "~/editor/planner/PlannerSearch";
import type { PlannerCoverageAuditItem } from "~/editor/planner/PlannerCoverageAudit";
import {
	PlannerCoverageTierAuditInputError,
	type PlannerCoverageTier,
	type PlannerCoverageTierAuditAttempt,
	type PlannerCoverageTierAuditItem,
	type PlannerCoverageTierAuditProgress,
	type PlannerCoverageTierAuditReport,
	type PlannerCoverageTierAuditTier,
	type PlannerCoverageTierDefinition,
} from "~/editor/planner/PlannerCoverageTierAudit";
import { auditPlannerCoverageWithPlannerFx } from "~/editor/planner/auditPlannerCoverageWithPlannerFx";
import { createBestFirstPlannerStrategyFx } from "~/editor/planner/createBestFirstPlannerStrategyFx";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import { mergePlannerCoverageTierAuditReportsFx } from "~/editor/planner/mergePlannerCoverageTierAuditReportsFx";
import { readPlannerCoverageAuditOutcomeCountsFx } from "~/editor/planner/readPlannerCoverageAuditOutcomeCountsFx";
import { readPlannerSearchBudgetFx } from "~/editor/planner/readPlannerSearchBudgetFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace auditPlannerCoverageTiersFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly initialReport?: PlannerCoverageTierAuditReport;
		readonly itemIds?: ReadonlyArray<IdSchema.Type>;
		readonly onProgress?: (progress: PlannerCoverageTierAuditProgress) => Effect.Effect<void>;
		readonly quantity?: number;
		readonly tiers: ReadonlyArray<PlannerCoverageTierDefinition>;
	}
}

const BudgetKeys = [
	"maximumExpandedStates",
	"maximumQueuedStates",
	"maximumRoutePlans",
	"maximumTraceLength",
] as const satisfies ReadonlyArray<keyof PlannerSearchBudget>;

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readPositiveInteger = (value: number | undefined, fallback: number) =>
	value === undefined || !Number.isFinite(value) ? fallback : Math.max(1, Math.floor(value));

const readSelectedItemIds = (
	config: GameConfigSchema.Type,
	itemIds?: ReadonlyArray<IdSchema.Type>,
) =>
	(itemIds ?? Object.keys(config.items))
		.filter((itemId): itemId is IdSchema.Type => config.items[itemId] !== undefined)
		.filter((itemId, index, all) => all.indexOf(itemId) === index)
		.sort(compareIds);

const readTiers = (
	definitions: ReadonlyArray<PlannerCoverageTierDefinition>,
): Effect.Effect<ReadonlyArray<PlannerCoverageTier>, PlannerCoverageTierAuditInputError> =>
	Effect.gen(function* () {
		if (definitions.length === 0)
			return yield* new PlannerCoverageTierAuditInputError({
				message: "Planner coverage tier audit requires at least one tier.",
			});
		const ids = new Set<string>();
		const tiers: PlannerCoverageTier[] = [];
		for (const [index, definition] of definitions.entries()) {
			const id = definition.id.trim();
			if (id.length === 0)
				return yield* new PlannerCoverageTierAuditInputError({
					message: `Planner coverage tier ${index + 1} has an empty id.`,
				});
			if (ids.has(id))
				return yield* new PlannerCoverageTierAuditInputError({
					message: `Planner coverage tier id is duplicated: ${id}.`,
				});
			ids.add(id);
			const budget = yield* readPlannerSearchBudgetFx(definition.budget);
			const previous = tiers.at(-1);
			if (previous !== undefined) {
				for (const key of BudgetKeys) {
					if (budget[key] < previous.budget[key])
						return yield* new PlannerCoverageTierAuditInputError({
							message: `Planner coverage tier ${id} lowers ${key} from ${previous.budget[key]} to ${budget[key]}.`,
						});
				}
			}
			tiers.push({
				budget,
				id,
			});
		}
		return tiers;
	});

const readTierItem = ({
	attempts,
	config,
	itemId,
}: {
	readonly attempts: ReadonlyArray<PlannerCoverageTierAuditAttempt>;
	readonly config: GameConfigSchema.Type;
	readonly itemId: IdSchema.Type;
}): PlannerCoverageTierAuditItem => {
	const item = config.items[itemId];
	const finalAttempt = attempts.at(-1);
	if (item === undefined || finalAttempt === undefined)
		throw new Error(`Planner tier audit item is missing an attempt: ${itemId}.`);
	const resolvedAttempt = attempts.find(({ result }) => result.outcome !== "inconclusive");
	return {
		attempts,
		finalOutcome: finalAttempt.result.outcome,
		itemId,
		itemType: item.type,
		...(resolvedAttempt === undefined
			? {}
			: {
					resolvedTierId: resolvedAttempt.tierId,
					resolvedTierIndex: resolvedAttempt.tierIndex,
				}),
		title: item.title,
	};
};

/** Audits increasing planner budgets while retrying only unresolved items at each tier. */
export const auditPlannerCoverageTiersFx = Effect.fn("auditPlannerCoverageTiersFx")(function* ({
	config,
	initialReport: sourceInitialReport,
	itemIds,
	onProgress,
	quantity: inputQuantity,
	tiers: tierDefinitions,
}: auditPlannerCoverageTiersFx.Props) {
	if (tierDefinitions.length === 0)
		return yield* new PlannerCoverageTierAuditInputError({
			message: "Planner coverage tier audit requires at least one new tier.",
		});
	const initialReport =
		sourceInitialReport === undefined
			? undefined
			: yield* mergePlannerCoverageTierAuditReportsFx([
					sourceInitialReport,
				]);
	const existingTierDefinitions =
		initialReport?.tiers.map(({ budget, id }) => ({
			budget,
			id,
		})) ?? [];
	const tiers = yield* readTiers([
		...existingTierDefinitions,
		...tierDefinitions,
	]);
	const existingTierCount = existingTierDefinitions.length;
	const newTiers = tiers.slice(existingTierCount);
	const quantity = initialReport?.quantity ?? readPositiveInteger(inputQuantity, 1);
	if (
		initialReport !== undefined &&
		inputQuantity !== undefined &&
		readPositiveInteger(inputQuantity, 1) !== initialReport.quantity
	)
		return yield* new PlannerCoverageTierAuditInputError({
			message: `Planner coverage resume quantity ${inputQuantity} does not match report quantity ${initialReport.quantity}.`,
		});
	const initialItemIds = initialReport?.items.map(({ itemId }) => itemId);
	const selectedItemIds = readSelectedItemIds(config, initialItemIds ?? itemIds);
	if (initialItemIds !== undefined) {
		if (selectedItemIds.length !== initialItemIds.length)
			return yield* new PlannerCoverageTierAuditInputError({
				message:
					"Planner coverage resume report references items missing from the current game config.",
			});
		if (itemIds !== undefined) {
			const requestedItemIds = readSelectedItemIds(config, itemIds);
			if (
				requestedItemIds.length !== selectedItemIds.length ||
				requestedItemIds.some((itemId, index) => itemId !== selectedItemIds[index])
			)
				return yield* new PlannerCoverageTierAuditInputError({
					message: "Planner coverage resume item selection does not match the report.",
				});
		}
	}
	const attemptsByItemId = new Map<IdSchema.Type, PlannerCoverageTierAuditAttempt[]>();
	const finalByItemId = new Map<IdSchema.Type, PlannerCoverageAuditItem>();
	for (const item of initialReport?.items ?? []) {
		attemptsByItemId.set(item.itemId, [
			...item.attempts,
		]);
		const finalAttempt = item.attempts.at(-1);
		if (finalAttempt === undefined)
			return yield* new PlannerCoverageTierAuditInputError({
				message: `Planner coverage resume item has no attempts: ${item.itemId}.`,
			});
		finalByItemId.set(item.itemId, finalAttempt.result);
	}
	const tierReports: PlannerCoverageTierAuditTier[] = [
		...(initialReport?.tiers ?? []),
	];
	let unresolvedItemIds = selectedItemIds.filter(
		(itemId) => finalByItemId.get(itemId)?.outcome === "inconclusive",
	);
	if (initialReport === undefined) unresolvedItemIds = selectedItemIds;

	for (const [tierOffset, tier] of newTiers.entries()) {
		const tierIndex = existingTierCount + tierOffset + 1;
		const carriedItems = [
			...finalByItemId.values(),
		];
		const carriedCompleted = carriedItems.filter(
			({ outcome }) => outcome === "completed",
		).length;
		const carriedNoFinitePath = carriedItems.filter(
			({ outcome }) => outcome === "no-finite-path",
		).length;
		const attemptedItemIds = unresolvedItemIds;
		const strategy = yield* createBestFirstPlannerStrategyFx({
			budget: tier.budget,
		});
		const planner = yield* createPlannerFx({
			config,
			strategy,
		});
		const attemptReport = yield* auditPlannerCoverageWithPlannerFx({
			budget: tier.budget,
			config,
			itemIds: attemptedItemIds,
			...(onProgress === undefined
				? {}
				: {
						onProgress: (progress) =>
							onProgress({
								...progress,
								tierCount: tiers.length,
								tierId: tier.id,
								tierIndex,
							}),
					}),
			planner,
			quantity,
		});
		for (const result of attemptReport.items) {
			const attempt = {
				result,
				tierId: tier.id,
				tierIndex,
			} satisfies PlannerCoverageTierAuditAttempt;
			const attempts = attemptsByItemId.get(result.itemId) ?? [];
			attempts.push(attempt);
			attemptsByItemId.set(result.itemId, attempts);
			finalByItemId.set(result.itemId, result);
		}
		const finalItems = selectedItemIds.flatMap((itemId) => {
			const item = finalByItemId.get(itemId);
			return item === undefined
				? []
				: [
						item,
					];
		});
		const cumulativeOutcomes = yield* readPlannerCoverageAuditOutcomeCountsFx(finalItems);
		const newlyCompleted = attemptReport.summary.outcomes.completed;
		const newlyNoFinitePath = attemptReport.summary.outcomes.noFinitePath;
		const newlyResolved = newlyCompleted + newlyNoFinitePath;
		tierReports.push({
			attemptSummary: attemptReport.summary,
			attemptedItems: attemptReport.summary.totalItems,
			budget: tier.budget,
			carriedCompleted,
			carriedNoFinitePath,
			cumulativeOutcomes,
			id: tier.id,
			index: tierIndex,
			marginalResolutionRate:
				attemptReport.summary.totalItems === 0
					? 0
					: newlyResolved / attemptReport.summary.totalItems,
			newlyCompleted,
			newlyNoFinitePath,
			remainingInconclusive: cumulativeOutcomes.inconclusive,
			resolutionRate:
				selectedItemIds.length === 0
					? 1
					: (cumulativeOutcomes.completed + cumulativeOutcomes.noFinitePath) /
						selectedItemIds.length,
		});
		unresolvedItemIds = selectedItemIds.filter(
			(itemId) => finalByItemId.get(itemId)?.outcome === "inconclusive",
		);
	}

	const items = selectedItemIds.map((itemId) =>
		readTierItem({
			attempts: attemptsByItemId.get(itemId) ?? [],
			config,
			itemId,
		}),
	);
	const finalAuditItems = selectedItemIds.flatMap((itemId) => {
		const item = finalByItemId.get(itemId);
		return item === undefined
			? []
			: [
					item,
				];
	});
	const finalOutcomes = yield* readPlannerCoverageAuditOutcomeCountsFx(finalAuditItems);
	const saturatedTier = tierReports.find(
		({ remainingInconclusive }) => remainingInconclusive === 0,
	);
	return {
		items,
		quantity,
		summary: {
			finalOutcomes,
			resolutionByTier: tierReports.map(
				({ id, index, newlyCompleted, newlyNoFinitePath }) => ({
					count: newlyCompleted + newlyNoFinitePath,
					tierId: id,
					tierIndex: index,
				}),
			),
			...(saturatedTier === undefined
				? {}
				: {
						saturatedTierId: saturatedTier.id,
						saturatedTierIndex: saturatedTier.index,
					}),
			search: {
				expandedStates: tierReports.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.expandedStates,
					0,
				),
				routePlans: tierReports.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.routePlans,
					0,
				),
				visitedStates: tierReports.reduce(
					(total, { attemptSummary }) => total + attemptSummary.search.visitedStates,
					0,
				),
			},
			tierCount: tiers.length,
			totalItems: selectedItemIds.length,
			totalSearchAttempts: tierReports.reduce(
				(total, { attemptedItems }) => total + attemptedItems,
				0,
			),
			totalSearchDurationMs: tierReports.reduce(
				(total, { attemptSummary }) => total + attemptSummary.latency.totalMs,
				0,
			),
			unresolvedItemIds,
		},
		tiers: tierReports,
		version: 1,
	} satisfies PlannerCoverageTierAuditReport;
});
