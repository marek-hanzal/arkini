import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type {
	AppliedGameEffectOperation,
	EffectiveChanceItemEntry,
	EffectiveLineOutputEntry,
	EffectiveLineOutputSet,
	EffectiveWeightedLineOutputSubEntry,
} from "~/effects/EffectiveLine";
import { createAppliedGameEffectOperation } from "~/effects/createAppliedGameEffectOperation";
import { doesGameGrantSelectorMatchIds } from "~/effects/doesGameGrantSelectorMatchIds";
import { readEffectiveDrop } from "~/effects/readEffectiveDrop";
import type { DropEffect, RuntimeItemSelector } from "~/effects/RuntimeLineEffectTypes";
import {
	readNearbyDurationMultiplier,
	readNearbyLineEffectMatches,
} from "~/effects/readNearbyLineEffectMatches";
import { readRuntimeLineEffectLabel } from "~/effects/readRuntimeLineEffectLabel";

type OutputSet = NonNullable<GameLineDefinition["output"]>[number];
type OutputEntry = OutputSet["entries"][number];

const readOutputDurationEffects = ({
	config,
	dropEffectIdPrefix,
	dropEffects,
	grantIds,
	outputItemId,
	itemInstanceId,
	save,
	targetCell,
}: {
	config: GameConfig;
	dropEffectIdPrefix: string;
	dropEffects: readonly DropEffect[] | undefined;
	grantIds: ReadonlySet<string>;
	outputItemId: string;
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
						durationMultiplier: multiplier,
						kind: effect.kind,
						lineEffectId: effectId,
						lineEffectName: effectName,
						sourceId: match.item.itemId,
						sourceItemInstanceId: match.item.id,
						targetItemId: outputItemId,
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
					durationMultiplier: effect.multiplier,
					kind: effect.kind,
					lineEffectId: effectId,
					lineEffectName: effectName,
					sourceItemInstanceId: itemInstanceId,
					targetItemId: outputItemId,
				}),
			);
		}
	}

	return {
		appliedEffects,
		durationMultiplier,
	};
};

const readOutputEntryItemIds = (entry: OutputEntry): readonly string[] =>
	entry.type === "weighted"
		? entry.entries.map((weightedEntry) => weightedEntry.itemId)
		: [
				entry.itemId,
			];

export const readEffectiveOutputEntries = ({
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
	const outputSets: EffectiveLineOutputSet[] = [];
	let durationMultiplier = 1;
	const applyDurationEffects = ({
		dropEffectIdPrefix,
		dropEffects,
		outputItemId,
	}: {
		dropEffectIdPrefix: string;
		dropEffects: readonly DropEffect[] | undefined;
		outputItemId: string;
	}) => {
		const duration = readOutputDurationEffects({
			config,
			dropEffectIdPrefix,
			dropEffects,
			grantIds,
			outputItemId,
			itemInstanceId,
			save,
			targetCell,
		});
		durationMultiplier *= duration.durationMultiplier;
		appliedEffects.push(...duration.appliedEffects);
	};

	for (const [outputSetIndex, outputSet] of output.entries()) {
		const rollableOutput: EffectiveLineOutputEntry[] = [];
		const visibleOutput: EffectiveLineOutputEntry[] = [];
		const chanceItems: EffectiveChanceItemEntry[] = [];
		const rollableDropIds = new Set<string>();

		for (const [outputIndex, entry] of outputSet.entries.entries()) {
			if (entry.type === "weighted") {
				const visibleEntries: EffectiveWeightedLineOutputSubEntry[] = [];
				const rollableEntries: EffectiveWeightedLineOutputSubEntry[] = [];

				for (const [weightedEntryIndex, weightedEntry] of entry.entries.entries()) {
					const sourceDropId = `${lineId}:output:${outputSetIndex}:entries:${outputIndex}:entry:${weightedEntryIndex}`;
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
							outputItemId: weightedEntry.itemId,
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

			const sourceDropId = `${lineId}:output:${outputSetIndex}:entries:${outputIndex}`;
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
				for (const outputItemId of readOutputEntryItemIds(entry)) {
					applyDurationEffects({
						dropEffectIdPrefix: sourceDropId,
						dropEffects: entry.effects,
						outputItemId,
					});
				}
			}
		}

		const filteredChanceItems = chanceItems.filter((chanceItem) =>
			rollableDropIds.has(chanceItem.sourceDropId),
		);
		if (
			visibleOutput.length > 0 ||
			rollableOutput.length > 0 ||
			filteredChanceItems.length > 0
		) {
			outputSets.push({
				baseOutput: rollableOutput,
				chanceItems: filteredChanceItems,
				visibleOutput,
				weight: outputSet.weight ?? 1,
			});
		}
	}

	return {
		appliedEffects,
		chanceItems: outputSets.flatMap((outputSet) => outputSet.chanceItems),
		durationMultiplier,
		outputSets,
		rollableOutput: outputSets.flatMap((outputSet) => outputSet.baseOutput),
		visibleOutput: outputSets.flatMap((outputSet) => outputSet.visibleOutput),
	};
};
