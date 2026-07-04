import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import { readGameCheatEffectiveDurationMs } from "~/cheat/GameCheatSpeedMode";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type {
	AppliedGameEffectOperation,
	EffectiveChanceItemEntry,
	EffectiveDropEffectOutcome,
	EffectiveLine,
	EffectiveLineOutputEntry,
	EffectiveWeightedLineOutputSubEntry,
} from "~/effects/EffectiveLine";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { createAppliedGameEffectOperation } from "~/effects/createAppliedGameEffectOperation";
import { readEffectiveLineRequirements } from "~/effects/readEffectiveLineRequirements";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";
import {
	readNearbyDurationMultiplier,
	readNearbyLineEffectMatches,
	type RuntimeItemSelector,
} from "~/effects/readNearbyLineEffectMatches";
import {
	formatChancePercent,
	readNearbyLootChanceSourceLabel,
	readRuntimeLineEffectLabel,
} from "~/effects/readRuntimeLineEffectLabel";

export namespace readEffectiveLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
		ignoreCapacitySpendRequirements?: boolean;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs?: number;
		itemInstanceId: string;
		line: GameLineDefinition;
		lineId: string;
		save: GameSave;
	}
}

type LineOutput = NonNullable<GameLineDefinition["output"]>[number];
type NonWeightedLineOutput = Exclude<
	LineOutput,
	{
		type: "weighted";
	}
>;
type DropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];
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

const readEffectiveDrop = ({
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

const readOutputDurationEffects = ({
	config,
	dropEffectIdPrefix,
	dropEffects,
	grantIds,
	itemInstanceId,
	save,
	targetCell,
}: {
	config: GameConfig;
	dropEffectIdPrefix: string;
	dropEffects: readonly DropEffect[] | undefined;
	grantIds: ReadonlySet<string>;
	itemInstanceId: string;
	save: GameSave;
	targetCell?: BoardCell;
}) => {
	let durationMultiplier = 1;
	const appliedEffects: AppliedGameEffectOperation[] = [];

	for (const [dropEffectIndex, effect] of (dropEffects ?? []).entries()) {
		const effectId = `${dropEffectIdPrefix}:effect:${dropEffectIndex}`;
		const effectName = readRuntimeLineEffectLabel({
			config,
			fallback: effect.kind,
			lineEffect: effect,
		});

		if (effect.kind === "nearby.duration.multiply") {
			const matches = readNearbyLineEffectMatches({
				items: effect.items as RuntimeItemSelector,
				radius: effect.radius,
				save,
				targetCell,
			}).slice(0, effect.maxSources ?? Number.POSITIVE_INFINITY);
			for (const match of matches) {
				const multiplier = readNearbyDurationMultiplier({
					bands: effect.bands,
					distance: match.distance,
				});
				if (multiplier === undefined) continue;
				durationMultiplier *= multiplier;
				appliedEffects.push(
					createAppliedGameEffectOperation({
						kind: effect.kind,
						lineEffectId: effectId,
						lineEffectName: effectName,
						sourceId: match.item.itemId,
						sourceItemInstanceId: match.item.id,
					}),
				);
			}
			continue;
		}

		if (effect.kind === "grant.duration.multiply") {
			const active = doesGameGrantSelectorMatchIds({
				grantIds,
				selector: effect.selector,
			});
			if (!active) continue;

			durationMultiplier *= effect.multiplier;
			appliedEffects.push(
				createAppliedGameEffectOperation({
					kind: effect.kind,
					lineEffectId: effectId,
					lineEffectName: effectName,
					sourceItemInstanceId: itemInstanceId,
				}),
			);
		}
	}

	return {
		appliedEffects,
		durationMultiplier,
	};
};

const readEffectiveOutputEntries = ({
	config,
	grantIds,
	output,
	itemInstanceId,
	lineId,
	lineVisible,
	save,
	targetCell,
}: {
	config: GameConfig;
	grantIds: ReadonlySet<string>;
	output: NonNullable<GameLineDefinition["output"]>;
	itemInstanceId: string;
	lineId: string;
	lineVisible: boolean;
	save: GameSave;
	targetCell?: BoardCell;
}) => {
	const appliedEffects: AppliedGameEffectOperation[] = [];
	const rollableOutput: EffectiveLineOutputEntry[] = [];
	const visibleOutput: EffectiveLineOutputEntry[] = [];
	const chanceItems: EffectiveChanceItemEntry[] = [];
	let durationMultiplier = 1;
	const rollableDropIds = new Set<string>();
	const applyDurationEffects = ({
		dropEffectIdPrefix,
		dropEffects,
	}: {
		dropEffectIdPrefix: string;
		dropEffects: readonly DropEffect[] | undefined;
	}) => {
		const duration = readOutputDurationEffects({
			config,
			dropEffectIdPrefix,
			dropEffects,
			grantIds,
			itemInstanceId,
			save,
			targetCell,
		});
		durationMultiplier *= duration.durationMultiplier;
		appliedEffects.push(...duration.appliedEffects);
	};

	for (const [outputIndex, entry] of output.entries()) {
		if (entry.type === "weighted") {
			const visibleEntries: EffectiveWeightedLineOutputSubEntry[] = [];
			const rollableEntries: EffectiveWeightedLineOutputSubEntry[] = [];

			for (const [weightedEntryIndex, weightedEntry] of entry.entries.entries()) {
				const sourceDropId = `${lineId}:output:${outputIndex}:entry:${weightedEntryIndex}`;
				const evaluation = readEffectiveDrop({
					config,
					defaultVisible: lineVisible,
					dropEffectIdPrefix: sourceDropId,
					dropEffects: weightedEntry.effects,
					enabled: weightedEntry.enabled,
					grantIds,
					itemId: weightedEntry.itemId,
					save,
					targetCell,
					visibility: weightedEntry.visibility,
				});
				chanceItems.push(...evaluation.chanceItems);
				const effectiveEntry = {
					...weightedEntry,
					dropEffects: evaluation.dropEffects,
					enabled: evaluation.enabled,
					visible: evaluation.visible,
				};
				if (evaluation.visible) visibleEntries.push(effectiveEntry);
				if (evaluation.visible && evaluation.enabled) {
					rollableEntries.push(effectiveEntry);
					rollableDropIds.add(sourceDropId);
					applyDurationEffects({
						dropEffectIdPrefix: sourceDropId,
						dropEffects: weightedEntry.effects,
					});
				}
			}

			if (visibleEntries.length > 0) {
				visibleOutput.push({
					...entry,
					dropEffects: [],
					enabled: rollableEntries.length > 0,
					entries: visibleEntries,
					visible: true,
				});
			}
			if (rollableEntries.length > 0) {
				rollableOutput.push({
					...entry,
					dropEffects: [],
					enabled: true,
					entries: rollableEntries,
					visible: true,
				});
			}
			continue;
		}

		const sourceDropId = `${lineId}:output:${outputIndex}`;
		const evaluation = readEffectiveDrop({
			config,
			defaultVisible: lineVisible,
			dropEffectIdPrefix: sourceDropId,
			dropEffects: entry.effects,
			enabled: entry.enabled,
			grantIds,
			itemId: entry.itemId,
			save,
			targetCell,
			visibility: entry.visibility,
		});
		chanceItems.push(...evaluation.chanceItems);
		const effectiveEntry = {
			...entry,
			dropEffects: evaluation.dropEffects,
			enabled: evaluation.enabled,
			visible: evaluation.visible,
		};

		if (evaluation.visible) visibleOutput.push(effectiveEntry);
		if (evaluation.visible && evaluation.enabled) {
			rollableOutput.push(effectiveEntry);
			rollableDropIds.add(sourceDropId);
			applyDurationEffects({
				dropEffectIdPrefix: sourceDropId,
				dropEffects: entry.effects,
			});
		}
	}

	return {
		appliedEffects,
		chanceItems: chanceItems.filter((chanceItem) =>
			rollableDropIds.has(chanceItem.sourceDropId),
		),
		durationMultiplier,
		rollableOutput,
		visibleOutput,
	};
};

export const readEffectiveLine = ({
	baseDurationMs,
	config,
	ignoreCapacitySpendRequirements,
	ignoredProducerJobIds,
	nowMs,
	itemInstanceId,
	line,
	lineId,
	save,
}: readEffectiveLine.Props): EffectiveLine => {
	const targetCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: itemInstanceId,
	});
	const grantIds = readGameWorldGrantIds({
		config,
		ignoredProducerJobIds,
		nowMs,
		save,
	});
	const effectiveOutput = readEffectiveOutputEntries({
		config,
		grantIds,
		output: line.output ?? [],
		itemInstanceId,
		lineId,
		lineVisible: line.visibility !== "hidden",
		save,
		targetCell,
	});
	const lineRequirements = readEffectiveLineRequirements({
		config,
		grantIds,
		ignoreCapacitySpendRequirements,
		itemInstanceId,
		line,
		lineId,
		save,
		targetCell,
	});
	const visible = line.output
		? effectiveOutput.visibleOutput.length > 0
		: line.visibility !== "hidden";
	const durationMultiplier = effectiveOutput.durationMultiplier;
	const durationMs = Math.max(0, Math.ceil(baseDurationMs * durationMultiplier));

	return {
		appliedEffects: effectiveOutput.appliedEffects,
		blocked: lineRequirements.blocked,
		blockReasons: lineRequirements.blockReasons,
		durationMs: readGameCheatEffectiveDurationMs({
			durationMs,
			save,
		}),
		effectDurationMultiplier: durationMultiplier === 1 ? undefined : durationMultiplier,
		grantIds: [
			...grantIds,
		].sort(),
		startRequirementsReady: lineRequirements.startRequirementsReady,
		lootPlan: {
			baseOutput: effectiveOutput.rollableOutput,
			chanceItems: effectiveOutput.chanceItems,
			visibleOutput: effectiveOutput.visibleOutput,
		},
		requirements: lineRequirements.requirements,
		visible,
	};
};
