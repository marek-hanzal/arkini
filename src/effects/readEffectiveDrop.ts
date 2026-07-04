import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveChanceItemEntry, EffectiveDropEffectOutcome } from "~/effects/EffectiveLine";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import type { DropEffect, RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import { readNearbyLineEffectMatches } from "~/effects/readNearbyLineEffectMatches";
import {
	formatChancePercent,
	readNearbyLootChanceSourceLabel,
	readRuntimeLineEffectLabel,
} from "~/effects/readRuntimeLineEffectLabel";

type DropEvaluation = {
	chanceItems: EffectiveChanceItemEntry[];
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

const shouldDropEffectDisplay = (effect: EffectiveDropEffectOutcome) => {
	if (effect.display === "never") return false;
	if (effect.display === "always") return true;
	if (effect.display === "whenMissing") return !effect.ready;
	return effect.active;
};

const createDropEffectOutcome = ({
	active,
	effect,
	effectId,
	effectName,
	impact,
	label,
	ready,
	result,
}: {
	active: boolean;
	effect: DropEffect;
	effectId: string;
	effectName: string;
	impact: EffectiveDropEffectOutcome["impact"];
	label?: string;
	ready: boolean;
	result: string;
}): EffectiveDropEffectOutcome => ({
	active,
	display: effect.display,
	effectId,
	effectName,
	impact,
	kind: effect.kind,
	label: label ?? effect.label ?? effectName,
	phase: "phase" in effect ? effect.phase : undefined,
	ready,
	result,
});

const readDropEffectGrantActive = ({
	effect,
	grantIds,
}: {
	effect: Extract<
		DropEffect,
		{
			selector: unknown;
		}
	>;
	grantIds: ReadonlySet<string>;
}) =>
	doesGameGrantSelectorMatchIds({
		grantIds,
		selector: effect.selector,
	});

const applyRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	ready,
	visible,
}: {
	chanceItems: EffectiveChanceItemEntry[];
	dropEffectId: string;
	dropEffectName: string;
	effect: Extract<
		DropEffect,
		{
			kind: "grant.require" | "nearby.require";
		}
	>;
	enabled: boolean;
	ready: boolean;
	visible: boolean;
}): DropEvaluation => {
	const visibilityPhase = effect.phase === "visibility";
	return {
		chanceItems,
		dropEffects: [
			createDropEffectOutcome({
				active: ready,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: visibilityPhase ? "visibility" : "availability",
				ready,
				result: ready
					? visibilityPhase
						? "shown"
						: "requirement met"
					: visibilityPhase
						? "hidden"
						: "disabled",
			}),
		],
		enabled: effect.phase === "start" && !ready ? false : enabled,
		visible: visibilityPhase ? ready : visible,
	};
};

type DropEffectApplicationProps = {
	chanceItems: EffectiveChanceItemEntry[];
	config: GameConfig;
	dropEffectId: string;
	dropEffectName: string;
	sourceDropId: string;
	effect: DropEffect;
	enabled: boolean;
	grantIds: ReadonlySet<string>;
	itemId: string;
	save: GameSave;
	targetCell?: BoardCell;
	visible: boolean;
};

type DropEffectApplicationPropsFor<Kind extends DropEffect["kind"]> = Omit<
	DropEffectApplicationProps,
	"effect"
> & {
	effect: Extract<
		DropEffect,
		{
			kind: Kind;
		}
	>;
};

const readUnchangedDropEvaluation = ({
	chanceItems,
	enabled,
	visible,
}: Pick<DropEffectApplicationProps, "chanceItems" | "enabled" | "visible">): DropEvaluation => ({
	chanceItems: [
		...chanceItems,
	],
	dropEffects: [],
	enabled,
	visible,
});

const applyGrantRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: DropEffectApplicationPropsFor<"grant.require">) =>
	applyRequirementDropEffect({
		chanceItems: [
			...chanceItems,
		],
		dropEffectId,
		dropEffectName,
		effect,
		enabled,
		ready: readDropEffectGrantActive({
			effect,
			grantIds,
		}),
		visible,
	});

const applyNearbyRequirementDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	save,
	targetCell,
	visible,
}: DropEffectApplicationPropsFor<"nearby.require">) =>
	applyRequirementDropEffect({
		chanceItems: [
			...chanceItems,
		],
		dropEffectId,
		dropEffectName,
		effect,
		enabled,
		ready:
			readNearbyLineEffectMatches({
				items: effect.items as Parameters<typeof readNearbyLineEffectMatches>[0]["items"],
				radius: effect.radius,
				save,
				targetCell,
			}).length > 0,
		visible,
	});

const applyGrantBlockStartDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: DropEffectApplicationPropsFor<"grant.blockStart">): DropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});

	return {
		chanceItems: [
			...chanceItems,
		],
		dropEffects: [
			createDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "availability",
				ready: !active,
				result: active ? "disabled" : "not blocked",
			}),
		],
		enabled: active ? false : enabled,
		visible,
	};
};

type GrantDropToggleEffectKind =
	| "grant.drop.disable"
	| "grant.drop.enable"
	| "grant.drop.hide"
	| "grant.drop.show";

const applyGrantDropToggleEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	effect,
	enabled,
	grantIds,
	visible,
}: DropEffectApplicationPropsFor<GrantDropToggleEffectKind>): DropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});
	const nextState = match(effect.kind)
		.with("grant.drop.hide", () => ({
			enabled,
			impact: "visibility" as const,
			ready: !active,
			result: active ? "hidden" : "inactive",
			visible: active ? false : visible,
		}))
		.with("grant.drop.show", () => ({
			enabled,
			impact: "visibility" as const,
			ready: active,
			result: active ? "shown" : "inactive",
			visible: active ? true : visible,
		}))
		.with("grant.drop.disable", () => ({
			enabled: active ? false : enabled,
			impact: "availability" as const,
			ready: !active,
			result: active ? "disabled" : "inactive",
			visible,
		}))
		.with("grant.drop.enable", () => ({
			enabled: active ? true : enabled,
			impact: "availability" as const,
			ready: active,
			result: active ? "enabled" : "inactive",
			visible,
		}))
		.exhaustive();

	return {
		chanceItems: [
			...chanceItems,
		],
		dropEffects: [
			createDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: nextState.impact,
				ready: nextState.ready,
				result: nextState.result,
			}),
		],
		enabled: nextState.enabled,
		visible: nextState.visible,
	};
};

const applyNearbyLootChanceDropEffect = ({
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
}: DropEffectApplicationPropsFor<"nearby.loot.outputChance.add">): DropEvaluation => {
	const activeSourceEffects: EffectiveDropEffectOutcome[] = [];
	let totalChance = 0;

	for (const [sourceIndex, source] of effect.sources.entries()) {
		const matches = readNearbyLineEffectMatches({
			items: source.items as RuntimeItemSelector,
			radius: effect.radius,
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
		const sourceEffect = createDropEffectOutcome({
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
		if (shouldDropEffectDisplay(sourceEffect)) {
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
			createDropEffectOutcome({
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

const applyGrantExtraOutputChanceDropEffect = ({
	chanceItems,
	dropEffectId,
	dropEffectName,
	sourceDropId,
	effect,
	enabled,
	grantIds,
	itemId,
	visible,
}: DropEffectApplicationPropsFor<"grant.loot.extraOutputChance.add">): DropEvaluation => {
	const active = readDropEffectGrantActive({
		effect,
		grantIds,
	});
	const activeChanceEffect = createDropEffectOutcome({
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
			dropEffects: shouldDropEffectDisplay(activeChanceEffect)
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
			createDropEffectOutcome({
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

const applyDropEffect = (props: DropEffectApplicationProps): DropEvaluation =>
	match(props.effect)
		.with(
			{
				kind: "grant.require",
			},
			(effect) =>
				applyGrantRequirementDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "nearby.require",
			},
			(effect) =>
				applyNearbyRequirementDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.blockStart",
			},
			(effect) =>
				applyGrantBlockStartDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.drop.hide",
			},
			{
				kind: "grant.drop.show",
			},
			{
				kind: "grant.drop.disable",
			},
			{
				kind: "grant.drop.enable",
			},
			(effect) =>
				applyGrantDropToggleEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "nearby.loot.outputChance.add",
			},
			(effect) =>
				applyNearbyLootChanceDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.loot.extraOutputChance.add",
			},
			(effect) =>
				applyGrantExtraOutputChanceDropEffect({
					...props,
					effect,
				}),
		)
		.with(
			{
				kind: "grant.duration.multiply",
			},
			{
				kind: "nearby.capacity.spend",
			},
			{
				kind: "nearby.duration.multiply",
			},
			() => readUnchangedDropEvaluation(props),
		)
		.exhaustive();

export const readEffectiveDrop = ({
	config,
	defaultVisible,
	dropEffectIdPrefix,
	dropEffects,
	enabled,
	grantIds,
	itemId,
	save,
	targetCell,
	visibility,
}: {
	config: GameConfig;
	defaultVisible: boolean;
	dropEffectIdPrefix: string;
	dropEffects: readonly DropEffect[] | undefined;
	enabled?: boolean;
	grantIds: ReadonlySet<string>;
	itemId: string;
	save: GameSave;
	targetCell?: BoardCell;
	visibility?: "hidden" | "visible";
}): DropEvaluation => {
	let evaluation: DropEvaluation = {
		chanceItems: [],
		dropEffects: [],
		enabled: enabled !== false,
		visible: defaultVisible && visibility !== "hidden",
	};

	for (const [dropEffectIndex, effect] of (dropEffects ?? []).entries()) {
		const dropEffectId = `${dropEffectIdPrefix}:effect:${dropEffectIndex}`;
		const dropEffectName = readRuntimeLineEffectLabel({
			config,
			fallback: effect.kind,
			lineEffect: effect,
		});
		const next = applyDropEffect({
			chanceItems: evaluation.chanceItems,
			config,
			dropEffectId,
			dropEffectName,
			sourceDropId: dropEffectIdPrefix,
			effect,
			enabled: evaluation.enabled,
			grantIds,
			itemId,
			save,
			targetCell,
			visible: evaluation.visible,
		});
		evaluation = {
			chanceItems: next.chanceItems,
			dropEffects: [
				...evaluation.dropEffects,
				...next.dropEffects.filter(shouldDropEffectDisplay),
			],
			enabled: next.enabled,
			visible: next.visible,
		};
	}

	return evaluation;
};
