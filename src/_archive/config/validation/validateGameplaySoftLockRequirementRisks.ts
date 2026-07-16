import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import {
	formatGrantSelector,
	formatIssuePath,
	formatItemSelector,
} from "~/config/validation/GameConfigValidationFormatting";
import {
	doesGameGrantSelectorMatchIdsLocal,
	readMandatoryGrantIds,
	readSelectorMatchingIds,
} from "~/config/validation/GameConfigSelectorValidation";
import {
	readGameplaySoftLockEffectUsages,
	type GameplaySoftLockEffectUsage,
} from "~/config/validation/readGameplaySoftLockEffectUsages";
import type {
	GameConfigRuntimeEffect,
	GameplaySource,
} from "~/config/validation/GameplaySoftLockTypes";

export const validateNearbyRequirementsHaveBoardSource = (
	ctx: z.RefinementCtx,
	config: GameConfig,
) => {
	for (const usage of readGameplaySoftLockEffectUsages(config).filter(
		(usage) => usage.enforceSoftLock,
	)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (
				lineEffect.kind !== "nearby.require" &&
				lineEffect.kind !== "nearby.capacity.spend"
			) {
				continue;
			}

			const matchingBoardItemIds = readSelectorMatchingIds({
				entityIds: Object.keys(config.items),
				selector: lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			}).filter((itemId) => config.items[itemId]?.storage !== "inventory");

			if (matchingBoardItemIds.length > 0) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"items",
				],
				`Soft-lock risk: ${lineEffect.kind} on ${usage.label} cannot be satisfied because its selector matches no board-placeable item. Selector: ${formatItemSelector(config, lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>)}.`,
			);
		}
	}
};

export const validateGrantRequirementsHavePossibleSource = (
	ctx: z.RefinementCtx,
	config: GameConfig,
	sources: readonly GameplaySource[],
) => {
	const possibleGrantIds = new Set(
		sources.filter((source) => source.targetKind === "grant").map((source) => source.targetId),
	);

	for (const usage of readGameplaySoftLockEffectUsages(config).filter(
		(usage) => usage.enforceSoftLock,
	)) {
		for (const [effectIndex, lineEffect] of usage.lineEffects.entries()) {
			if (lineEffect.kind !== "grant.require") continue;
			if (doesGameGrantSelectorMatchIdsLocal(possibleGrantIds, lineEffect.selector)) continue;

			addIssue(
				ctx,
				[
					...usage.path,
					effectIndex,
					"selector",
				],
				`Soft-lock risk: grant requirement on ${usage.label} can never be satisfied because no passive item or active line can provide ${formatGrantSelector(config, lineEffect.selector)}.`,
			);
		}
	}
};

type GrantBlockerEntry = {
	effectIndex: number;
	lineEffect: Extract<
		GameConfigRuntimeEffect,
		{
			kind: "grant.blockStart";
		}
	>;
};

type GrantRequirementEntry = {
	effectIndex: number;
	lineEffect: Extract<
		GameConfigRuntimeEffect,
		{
			kind: "grant.require";
		}
	>;
	requiredGrantIds: Set<string>;
};

const readGrantBlockerEntries = (lineEffects: readonly GameConfigRuntimeEffect[]) =>
	lineEffects
		.map((lineEffect, effectIndex) => ({
			effectIndex,
			lineEffect,
		}))
		.filter(
			(entry): entry is GrantBlockerEntry => entry.lineEffect.kind === "grant.blockStart",
		);

const readGrantRequirementEntries = (lineEffects: readonly GameConfigRuntimeEffect[]) =>
	lineEffects.flatMap((lineEffect, effectIndex): GrantRequirementEntry[] => {
		if (lineEffect.kind !== "grant.require") return [];
		const requiredGrantIds = readMandatoryGrantIds(lineEffect.selector);
		return requiredGrantIds.size > 0
			? [
					{
						effectIndex,
						lineEffect,
						requiredGrantIds,
					},
				]
			: [];
	});

const addGrantRequirementBlockerContradictionIssue = ({
	blocker,
	config,
	ctx,
	requirement,
	usage,
}: {
	blocker: GrantBlockerEntry;
	config: GameConfig;
	ctx: z.RefinementCtx;
	requirement: GrantRequirementEntry;
	usage: GameplaySoftLockEffectUsage;
}) => {
	addIssue(
		ctx,
		[
			...usage.path,
			requirement.effectIndex,
			"selector",
		],
		`Soft-lock risk: ${usage.label} requires and blocks the same mandatory grant set. Required ${formatGrantSelector(config, requirement.lineEffect.selector)} conflicts with blocker ${formatGrantSelector(config, blocker.lineEffect.selector)} at ${formatIssuePath(
			[
				...usage.path,
				blocker.effectIndex,
				"selector",
			],
		)}.`,
	);
};

const validateGrantRequirementBlockerUsageContradictions = ({
	config,
	ctx,
	usage,
}: {
	config: GameConfig;
	ctx: z.RefinementCtx;
	usage: GameplaySoftLockEffectUsage;
}) => {
	const blockers = readGrantBlockerEntries(usage.lineEffects);
	if (blockers.length === 0) return;

	for (const requirement of readGrantRequirementEntries(usage.lineEffects)) {
		for (const blocker of blockers) {
			if (
				!doesGameGrantSelectorMatchIdsLocal(
					requirement.requiredGrantIds,
					blocker.lineEffect.selector,
				)
			) {
				continue;
			}

			addGrantRequirementBlockerContradictionIssue({
				blocker,
				config,
				ctx,
				requirement,
				usage,
			});
		}
	}
};

export const validateGrantRequirementBlockerContradictions = (
	ctx: z.RefinementCtx,
	config: GameConfig,
) => {
	for (const usage of readGameplaySoftLockEffectUsages(config).filter(
		(usage) => usage.enforceSoftLock,
	)) {
		validateGrantRequirementBlockerUsageContradictions({
			config,
			ctx,
			usage,
		});
	}
};
