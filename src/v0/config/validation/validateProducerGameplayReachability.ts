import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import {
	formatIssuePath,
	formatItemLabel,
} from "~/config/validation/GameConfigValidationFormatting";
import { readMissingGameplayRequirements } from "~/config/validation/GameplaySoftLockRequirements";
import type {
	GameplayReachability,
	GameplayReachableEntityKind,
	GameplaySource,
} from "~/config/validation/GameplaySoftLockTypes";
import { isGameplayProgressionProducer } from "~/config/validation/readGameplaySoftLockEffectUsages";

export const validateProducerGameplayReachability = (
	ctx: z.RefinementCtx,
	config: GameConfig,
	sources: readonly GameplaySource[],
	reachability: GameplayReachability,
) => {
	for (const [itemId, item] of Object.entries(config.items).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		if (!item.producer && !item.stash) continue;
		if (!isGameplayProgressionProducer(config, itemId)) continue;
		if (reachability.reachableItemIds.has(itemId)) continue;

		addIssue(
			ctx,
			[
				"items",
				itemId,
			],
			formatUnreachableGameplayTargetMessage({
				config,
				reachability,
				sources,
				targetId: itemId,
				targetKind: "item",
				targetLabel: `producer ${formatItemLabel(config, itemId)}`,
			}),
		);
	}
};

const formatUnreachableGameplayTargetMessage = ({
	config,
	reachability,
	sources,
	targetId,
	targetKind,
	targetLabel,
}: {
	config: GameConfig;
	reachability: GameplayReachability;
	sources: readonly GameplaySource[];
	targetId: string;
	targetKind: GameplayReachableEntityKind;
	targetLabel: string;
}) => {
	const targetSources = sources.filter(
		(source) => source.targetKind === targetKind && source.targetId === targetId,
	);

	if (targetSources.length === 0) {
		return `Soft-lock risk: ${targetLabel} is not reachable from startingState. No starting entry, merge, craft recipe, line output, passive effect, or active effect can create it.`;
	}

	const closestSource = [
		...targetSources,
	].sort(
		(left, right) =>
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: left.requirements,
			}).length -
			readMissingGameplayRequirements({
				config,
				reachability,
				requirements: right.requirements,
			}).length,
	)[0];

	const missingRequirements = closestSource
		? readMissingGameplayRequirements({
				config,
				reachability,
				requirements: closestSource.requirements,
			})
		: [];
	const missingLabel =
		missingRequirements.length > 0
			? ` Missing: ${missingRequirements.slice(0, 6).join("; ")}.`
			: " The dependency chain is cyclic or blocked by selectors that never become true.";
	const sourceLabel = closestSource
		? ` Closest source: ${closestSource.label} at ${formatIssuePath(closestSource.path)}.`
		: "";

	return `Soft-lock risk: ${targetLabel} is not reachable from startingState.${sourceLabel}${missingLabel}`;
};
