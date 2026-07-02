import type { BoardCell } from "~/board/logic/BoardCell";
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
import { readChebyshevDistance } from "~/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/effects/readGameEffectSourceCell";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";
import { doesResolvedDomainSelectorMatchId } from "~/selector/doesResolvedDomainSelectorMatchId";

export namespace readEffectiveLine {
	export interface Props {
		baseDurationMs: number;
		config: GameConfig;
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
type WeightedLineOutput = Extract<
	LineOutput,
	{
		type: "weighted";
	}
>;
type WeightedLineEntry = WeightedLineOutput["entries"][number];
type DropEffect = NonNullable<NonWeightedLineOutput["effects"]>[number];

type DropEvaluation = {
	chanceItems: EffectiveChanceItemEntry[];
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

type RuntimeItemSelector = Extract<
	DropEffect,
	{
		kind: "nearby.duration.multiply" | "nearby.require";
	}
>["items"];

type NearbyLootChanceEffect = Extract<
	DropEffect,
	{
		kind: "nearby.loot.outputChance.add";
	}
>;

type NearbyLootChanceSource = NearbyLootChanceEffect["sources"][number];

type NearbyLineEffect = Extract<
	DropEffect,
	{
		kind: "nearby.duration.multiply" | "nearby.require";
	}
>;

const readItemName = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.name ?? itemId;

const readSelectorClauseIds = (
	clause:
		| {
				id: string;
		  }
		| {
				ids: string[];
		  }
		| {
				tag: string;
		  },
) => {
	if ("ids" in clause) return clause.ids;
	if ("id" in clause)
		return [
			clause.id,
		];
	return [];
};

const readSelectorPositiveIds = (selector: RuntimeItemSelector) => {
	if ("mode" in selector) return [];

	const ids = new Set<string>();
	for (const clause of selector.anyOf ?? []) {
		for (const id of readSelectorClauseIds(clause)) ids.add(id);
	}
	for (const clause of selector.allOf ?? []) {
		for (const id of readSelectorClauseIds(clause)) ids.add(id);
	}

	return [
		...ids,
	];
};

const formatList = (values: readonly string[]) => {
	if (values.length === 0) return "matching item";
	if (values.length === 1) return values[0] ?? "matching item";
	return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
};

const formatChancePercent = (chance: number) => {
	const percent = chance * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

const readNearbyItemSelectorLabel = ({
	config,
	selector,
}: {
	config: GameConfig;
	selector: RuntimeItemSelector;
}) =>
	formatList(
		readSelectorPositiveIds(selector).map((itemId) =>
			readItemName({
				config,
				itemId,
			}),
		),
	);

const readNearbyLineEffectLabel = ({
	config,
	lineEffect,
}: {
	config: GameConfig;
	lineEffect: NearbyLineEffect;
}) => {
	const itemLabel = readNearbyItemSelectorLabel({
		config,
		selector: lineEffect.items as RuntimeItemSelector,
	});
	return lineEffect.kind === "nearby.duration.multiply"
		? `Nearby ${itemLabel} enables production`
		: `Nearby ${itemLabel}`;
};

const readNearbyLootChanceSourceLabel = ({
	config,
	source,
}: {
	config: GameConfig;
	source: NearbyLootChanceSource;
}) =>
	source.label ??
	`Nearby ${readNearbyItemSelectorLabel({
		config,
		selector: source.items as RuntimeItemSelector,
	})}`;

const readLineEffectLabel = ({
	config,
	fallback,
	lineEffect,
}: {
	config: GameConfig;
	fallback: string;
	lineEffect: DropEffect;
}) => {
	if (lineEffect.kind === "nearby.require") {
		return readNearbyLineEffectLabel({
			config,
			lineEffect: lineEffect as NearbyLineEffect,
		});
	}
	if (lineEffect.kind === "nearby.duration.multiply") {
		return readNearbyLineEffectLabel({
			config,
			lineEffect,
		});
	}
	return lineEffect.label ?? fallback;
};

const createAppliedOperation = ({
	kind,
	lineEffectId,
	lineEffectName,
	sourceId = lineEffectId,
	sourceItemInstanceId,
}: {
	kind: AppliedGameEffectOperation["kind"];
	lineEffectId: string;
	lineEffectName: string;
	sourceId?: string;
	sourceItemInstanceId: string;
}): AppliedGameEffectOperation => ({
	effectId: lineEffectId,
	effectName: lineEffectName,
	kind,
	sourceId,
	sourceItemInstanceId,
});

const readNearbyMatches = ({
	items,
	radius,
	save,
	targetCell,
}: {
	items: RuntimeItemSelector;
	radius: number;
	save: GameSave;
	targetCell?: BoardCell;
}) => {
	if (!targetCell) return [];

	return Object.values(save.board.items)
		.flatMap((item) => {
			const cell = readGameEffectSourceCell({
				save,
				sourceItemInstanceId: item.id,
			});
			if (!cell) return [];
			if (
				!doesResolvedDomainSelectorMatchId({
					entityId: item.itemId,
					selector: items as Parameters<
						typeof doesResolvedDomainSelectorMatchId
					>[0]["selector"],
				})
			) {
				return [];
			}
			const distance = readChebyshevDistance(cell, targetCell);
			if (distance > radius) return [];
			return [
				{
					distance,
					item,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance || left.item.id.localeCompare(right.item.id),
		);
};

const readDistanceMultiplier = ({
	bands,
	distance,
}: {
	bands: Extract<
		DropEffect,
		{
			kind: "nearby.duration.multiply";
		}
	>["bands"];
	distance: number;
}) =>
	bands.find(
		(band) =>
			distance >= band.minDistance &&
			(band.maxDistance === undefined || distance <= band.maxDistance),
	)?.multiplier;

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

const applyDropEffect = ({
	chanceItems,
	config,
	dropEffectId,
	dropEffectName,
	sourceDropId,
	effect,
	enabled,
	grantIds,
	itemId,
	save,
	targetCell,
	visible,
}: {
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
}): DropEvaluation => {
	const dropEffects: EffectiveDropEffectOutcome[] = [];
	let nextVisible = visible;
	let nextEnabled = enabled;
	const nextChanceItems = [
		...chanceItems,
	];

	if (effect.kind === "grant.require") {
		return applyRequirementDropEffect({
			chanceItems: nextChanceItems,
			dropEffectId,
			dropEffectName,
			effect,
			enabled: nextEnabled,
			ready: readDropEffectGrantActive({
				effect,
				grantIds,
			}),
			visible: nextVisible,
		});
	}

	if (effect.kind === "nearby.require") {
		return applyRequirementDropEffect({
			chanceItems: nextChanceItems,
			dropEffectId,
			dropEffectName,
			effect,
			enabled: nextEnabled,
			ready:
				readNearbyMatches({
					items: effect.items as Parameters<typeof readNearbyMatches>[0]["items"],
					radius: effect.radius,
					save,
					targetCell,
				}).length > 0,
			visible: nextVisible,
		});
	}

	if (effect.kind === "grant.blockStart") {
		const active = readDropEffectGrantActive({
			effect,
			grantIds,
		});
		if (active) nextEnabled = false;
		dropEffects.push(
			createDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "availability",
				ready: !active,
				result: active ? "disabled" : "not blocked",
			}),
		);
		return {
			chanceItems: nextChanceItems,
			dropEffects,
			enabled: nextEnabled,
			visible: nextVisible,
		};
	}

	if (
		effect.kind === "grant.drop.hide" ||
		effect.kind === "grant.drop.show" ||
		effect.kind === "grant.drop.disable" ||
		effect.kind === "grant.drop.enable"
	) {
		const active = readDropEffectGrantActive({
			effect,
			grantIds,
		});
		if (active && effect.kind === "grant.drop.hide") nextVisible = false;
		if (active && effect.kind === "grant.drop.show") nextVisible = true;
		if (active && effect.kind === "grant.drop.disable") nextEnabled = false;
		if (active && effect.kind === "grant.drop.enable") nextEnabled = true;
		dropEffects.push(
			createDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact:
					effect.kind === "grant.drop.hide" || effect.kind === "grant.drop.show"
						? "visibility"
						: "availability",
				ready:
					effect.kind === "grant.drop.hide" || effect.kind === "grant.drop.disable"
						? !active
						: active,
				result: active
					? effect.kind === "grant.drop.hide"
						? "hidden"
						: effect.kind === "grant.drop.show"
							? "shown"
							: effect.kind === "grant.drop.disable"
								? "disabled"
								: "enabled"
					: "inactive",
			}),
		);
		return {
			chanceItems: nextChanceItems,
			dropEffects,
			enabled: nextEnabled,
			visible: nextVisible,
		};
	}

	if (effect.kind === "nearby.loot.outputChance.add") {
		const activeSourceEffects: EffectiveDropEffectOutcome[] = [];
		let totalChance = 0;

		for (const [sourceIndex, source] of effect.sources.entries()) {
			const matches = readNearbyMatches({
				items: source.items as RuntimeItemSelector,
				radius: effect.radius,
				save,
				targetCell,
			});
			const sourceTotalChance = matches.length * source.chance;
			totalChance += sourceTotalChance;
			const active = matches.length > 0;
			const sourceEffect = createDropEffectOutcome({
				active,
				effect,
				effectId: `${dropEffectId}:source:${sourceIndex}`,
				effectName: readNearbyLootChanceSourceLabel({
					config,
					source,
				}),
				impact: "chance",
				label: readNearbyLootChanceSourceLabel({
					config,
					source,
				}),
				ready: active,
				result: active
					? `+${formatChancePercent(sourceTotalChance)} (${matches.length}× ${formatChancePercent(source.chance)})`
					: "inactive",
			});
			if (shouldDropEffectDisplay(sourceEffect)) {
				activeSourceEffects.push(sourceEffect);
			}
		}

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

		const summaryEffect = createDropEffectOutcome({
			active: totalChance > 0,
			effect,
			effectId: dropEffectId,
			effectName: dropEffectName,
			impact: "chance",
			ready: totalChance > 0,
			result: totalChance > 0 ? `+${formatChancePercent(totalChance)} total` : "inactive",
		});
		dropEffects.push(summaryEffect);

		return {
			chanceItems: nextChanceItems,
			dropEffects,
			enabled: nextEnabled,
			visible: nextVisible,
		};
	}

	if (effect.kind === "grant.loot.extraOutputChance.add") {
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
			result: `+${Math.round(effect.chance * 1000) / 10}% extra roll`,
		});
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
		dropEffects.push(
			createDropEffectOutcome({
				active,
				effect,
				effectId: dropEffectId,
				effectName: dropEffectName,
				impact: "chance",
				ready: active,
				result: active
					? `+${Math.round(effect.chance * 1000) / 10}% extra roll`
					: "inactive",
			}),
		);
		return {
			chanceItems: nextChanceItems,
			dropEffects,
			enabled: nextEnabled,
			visible: nextVisible,
		};
	}

	return {
		chanceItems: nextChanceItems,
		dropEffects,
		enabled: nextEnabled,
		visible: nextVisible,
	};
};

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
		const dropEffectName = readLineEffectLabel({
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
		const effectName = readLineEffectLabel({
			config,
			fallback: effect.kind,
			lineEffect: effect,
		});

		if (effect.kind === "nearby.duration.multiply") {
			const matches = readNearbyMatches({
				items: effect.items as RuntimeItemSelector,
				radius: effect.radius,
				save,
				targetCell,
			}).slice(0, effect.maxSources ?? Number.POSITIVE_INFINITY);
			for (const match of matches) {
				const multiplier = readDistanceMultiplier({
					bands: effect.bands,
					distance: match.distance,
				});
				if (multiplier === undefined) continue;
				durationMultiplier *= multiplier;
				appliedEffects.push(
					createAppliedOperation({
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
				createAppliedOperation({
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
	const visible = line.output
		? effectiveOutput.visibleOutput.length > 0
		: line.visibility !== "hidden";
	const durationMultiplier = effectiveOutput.durationMultiplier;
	const durationMs = Math.max(0, Math.ceil(baseDurationMs * durationMultiplier));

	return {
		appliedEffects: effectiveOutput.appliedEffects,
		blocked: false,
		blockReasons: [],
		durationMs: readGameCheatEffectiveDurationMs({
			durationMs,
			save,
		}),
		effectDurationMultiplier: durationMultiplier === 1 ? undefined : durationMultiplier,
		grantIds: [
			...grantIds,
		].sort(),
		startRequirementsReady: true,
		lootPlan: {
			baseOutput: effectiveOutput.rollableOutput,
			chanceItems: effectiveOutput.chanceItems,
			visibleOutput: effectiveOutput.visibleOutput,
		},
		requirements: [],
		visible,
	};
};
