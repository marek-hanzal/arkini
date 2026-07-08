import {
	createEffectiveDropEffectOutcome,
	shouldDisplayEffectiveDropEffect,
} from "~/effects/createEffectiveDropEffectOutcome";
import type {
	EffectiveDropEffectApplicationPropsFor,
	EffectiveDropEvaluation,
} from "~/effects/EffectiveDropEvaluation";
import type { EffectiveDropEffectOutcome } from "~/effects/EffectiveLine";
import type { RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import { readDropEffectGrantActive } from "~/effects/readDropEffectGrantActive";
import { readNearbyLineEffectMatches } from "~/effects/readNearbyLineEffectMatches";
import {
	formatChancePercent,
	readNearbyLootChanceSourceLabel,
} from "~/effects/readRuntimeLineEffectLabel";

export const applyNearbyLootChanceDropEffect = ({
	chanceItems,
	config,
	dropEffectId,
	dropEffectName,
	sourceDropId,
	effect,
	enabled,
	itemId,
	save,
	targetCell,
	visible,
}: EffectiveDropEffectApplicationPropsFor<"nearby.loot.outputChance.add">): EffectiveDropEvaluation => {
	const activeSourceEffects: EffectiveDropEffectOutcome[] = [];
	let totalChance = 0;

	for (const [sourceIndex, source] of effect.sources.entries()) {
		const matches = readNearbyLineEffectMatches({
			items: source.items as RuntimeItemSelector,
			nearbyDistance: effect.distance,
			save,
			targetCell,
		});
		const sourceTotalChance = matches.length * source.chance;
		totalChance += sourceTotalChance;
		const active = matches.length > 0;
		const sourceEffectLabel = readNearbyLootChanceSourceLabel({
			config,
			source,
		});
		const sourceEffect = createEffectiveDropEffectOutcome({
			active,
			effect,
			effectId: `${dropEffectId}:source:${sourceIndex}`,
			effectName: sourceEffectLabel,
			impact: "chance",
			label: sourceEffectLabel,
			ready: active,
			result: active
				? `+${formatChancePercent(sourceTotalChance)} (${matches.length}× ${formatChancePercent(source.chance)})`
				: "inactive",
		});
		if (shouldDisplayEffectiveDropEffect(sourceEffect)) {
			activeSourceEffects.push(sourceEffect);
		}
	}

	const nextChanceItems = [
		...chanceItems,
	];
	if (totalChance > 0) {
		nextChanceItems.push({
			chance: totalChance,
			dropEffects: activeSourceEffects.length ? activeSourceEffects : undefined,
			effectId: dropEffectId,
			effectName: dropEffectName,
			sourceDropId,
			itemId,
			quantity: effect.quantity,
		});
	}

	return {
		chanceItems: nextChanceItems,
		dropEffects: [
			createEffectiveDropEffectOutcome({
				active: totalChance > 0,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "chance",
				ready: totalChance > 0,
				result: totalChance > 0 ? `+${formatChancePercent(totalChance)} total` : "inactive",
			}),
		],
		enabled,
		visible,
	};
};

const formatExtraOutputChanceResult = (chance: number) =>
	`+${Math.round(chance * 1000) / 10}% extra roll`;

export const applyGrantExtraOutputChanceDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	sourceDropId,
	effect,
	enabled,
	grantIds,
	itemId,
	visible,
}: EffectiveDropEffectApplicationPropsFor<"grant.loot.extraOutputChance.add">): EffectiveDropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});
	const activeChanceEffect = createEffectiveDropEffectOutcome({
		active: true,
		effect,
		effectId: dropEffectId,
		effectName: dropEffectName,
		impact: "chance",
		ready: true,
		result: formatExtraOutputChanceResult(effect.chance),
	});
	const nextChanceItems = [
		...chanceItems,
	];
	if (active) {
		nextChanceItems.push({
			chance: effect.chance,
			dropEffects: shouldDisplayEffectiveDropEffect(activeChanceEffect)
				? [
						activeChanceEffect,
					]
				: undefined,
			effectId: dropEffectId,
			effectName: dropEffectName,
			sourceDropId,
			itemId,
			quantity: effect.quantity,
		});
	}

	return {
		chanceItems: nextChanceItems,
		dropEffects: [
			createEffectiveDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "chance",
				ready: active,
				result: active ? formatExtraOutputChanceResult(effect.chance) : "inactive",
			}),
		],
		enabled,
		visible,
	};
};
