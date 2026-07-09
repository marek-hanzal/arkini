import type { LineView } from "~/board/view/LineViewSchema";
import { readGameSaveItemQuantityByScope } from "~/activation/readGameSaveItemQuantityByScope";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveDropEffectOutcome, EffectiveLine } from "~/effects/EffectiveLine";
import type { EffectiveLineBonusEntry } from "~/effects/readEffectiveLineBonusEntries";

type LineOutputEntry = EffectiveLine["lootPlan"]["visibleOutput"][number];
type LineOutputView = NonNullable<LineView["outputs"]>[number];
type LineOutputQuantity = NonNullable<LineOutputView["quantity"]>;

type IndexedLineOutputView = LineOutputView & {
	readonly sourceIndex: number;
};

export namespace readRuntimeLineOutputViews {
	export interface Props {
		effectBonusEntries?: readonly EffectiveLineBonusEntry[];
		effectiveLine: EffectiveLine;
		save: GameSave;
	}
}

const maxUnsortedOutputSort = Number.MAX_SAFE_INTEGER;

const readOutputQuantity = (quantity: LineOutputQuantity | undefined): LineOutputQuantity =>
	quantity ?? 1;

const readOutputEntrySort = (
	output: {
		sort?: number;
	},
	entrySort?: number,
) => entrySort ?? output.sort;

const readOutputProbability = ({
	enabled,
	entry,
}: {
	enabled?: boolean;
	entry: Extract<
		LineOutputEntry,
		{
			type: "chance" | "guaranteed";
		}
	>;
}) => {
	if (enabled === false) return 0;
	if (entry.type === "chance") return entry.chance;
	return undefined;
};

const readOwnedQuantity = ({ itemId, save }: { itemId: string; save: GameSave }) =>
	readGameSaveItemQuantityByScope({
		itemId,
		save,
		scope: "board_or_inventory",
	});

const readDropEffects = (effects: readonly EffectiveDropEffectOutcome[] | undefined) =>
	effects?.length
		? effects.map((effect) => ({
				active: effect.active,
				impact: effect.impact,
				kind: effect.kind,
				label: effect.label,
				ready: effect.ready,
				result: effect.result,
			}))
		: undefined;

const createOutputView = ({
	bonusLines,
	enabled,
	effects,
	itemId,
	kind,
	ownedQuantity,
	probability,
	quantity,
	rollLabel,
	rollSetLabel,
	sort,
	sourceIndex,
}: IndexedLineOutputView): IndexedLineOutputView => ({
	bonusLines,
	enabled,
	effects,
	itemId,
	kind,
	ownedQuantity,
	probability,
	quantity,
	rollLabel,
	rollSetLabel,
	sort,
	sourceIndex,
});

const readRollLabel = (rolls: LineOutputQuantity) => {
	if (typeof rolls !== "number") return `weighted · ${rolls.min}-${rolls.max} rolls`;
	return rolls > 1 ? `weighted · ${rolls} rolls` : "weighted roll";
};

const formatRollSetPercent = (value: number) => {
	const percent = value * 100;
	if (percent >= 10) return `${Math.round(percent)}%`;
	return `${Number(percent.toFixed(1))}%`;
};

const readRollSetLabel = ({
	outputSetIndex,
	outputSetWeight,
	totalWeight,
}: {
	outputSetIndex: number;
	outputSetWeight: number;
	totalWeight: number;
}) => `Set ${outputSetIndex + 1} · ${formatRollSetPercent(outputSetWeight / totalWeight)}`;

const pushUniqueBonusLine = (lines: string[], line: string) => {
	if (lines.includes(line)) return;
	lines.push(line);
};

const readBonusLinesByItemId = (
	entries: readonly EffectiveLineBonusEntry[],
): ReadonlyMap<string, readonly string[]> => {
	const byItemId = new Map<string, string[]>();

	for (const entry of entries) {
		if (!entry.itemId) continue;
		const lines = byItemId.get(entry.itemId) ?? [];
		pushUniqueBonusLine(lines, entry.label);
		byItemId.set(entry.itemId, lines);
	}

	return byItemId;
};

const readUniversalBonusLines = (
	entries: readonly EffectiveLineBonusEntry[],
): readonly string[] => {
	const lines: string[] = [];
	for (const entry of entries) {
		if (entry.itemId) continue;
		pushUniqueBonusLine(lines, entry.label);
	}
	return lines;
};

const readOutputBonusLines = ({
	bonusLinesByItemId,
	itemId,
	universalBonusLines,
}: {
	bonusLinesByItemId: ReadonlyMap<string, readonly string[]>;
	itemId: string;
	universalBonusLines: readonly string[];
}) => {
	const lines = [...universalBonusLines, ...(bonusLinesByItemId.get(itemId) ?? [])];
	return lines.length > 0 ? lines : undefined;
};

const readWeightedOutputTotalWeight = (
	entries: Extract<
		EffectiveLine["lootPlan"]["visibleOutput"][number],
		{
			type: "weighted";
		}
	>["entries"],
) => entries.filter((entry) => entry.enabled).reduce((total, entry) => total + entry.weight, 0);

const readWeightedOutputProbability = ({
	entry,
	totalWeight,
}: {
	entry: Extract<
		EffectiveLine["lootPlan"]["visibleOutput"][number],
		{
			type: "weighted";
		}
	>["entries"][number];
	totalWeight: number;
}) => {
	if (entry.enabled === false || totalWeight <= 0) return 0;
	return entry.weight / totalWeight;
};

const collectOutputViews = ({
	bonusLinesByItemId,
	output,
	rollSetLabel,
	save,
	sourceIndexOffset,
	universalBonusLines,
}: {
	bonusLinesByItemId: ReadonlyMap<string, readonly string[]>;
	output: EffectiveLine["lootPlan"]["visibleOutput"];
	rollSetLabel?: string;
	save: GameSave;
	sourceIndexOffset: number;
	universalBonusLines: readonly string[];
}): IndexedLineOutputView[] =>
	output.flatMap((entry, outputIndex): IndexedLineOutputView[] => {
		const sourceIndex = sourceIndexOffset + outputIndex;

		if (entry.type === "weighted") {
			const totalWeight = readWeightedOutputTotalWeight(entry.entries);
			return entry.entries.map((weightedEntry, weightedEntryIndex) =>
				createOutputView({
					bonusLines: readOutputBonusLines({
						bonusLinesByItemId,
						itemId: weightedEntry.itemId,
						universalBonusLines,
					}),
					enabled: weightedEntry.enabled,
					effects: readDropEffects(weightedEntry.dropEffects),
					itemId: weightedEntry.itemId,
					kind: "weighted",
					ownedQuantity: readOwnedQuantity({
						itemId: weightedEntry.itemId,
						save,
					}),
					probability: readWeightedOutputProbability({
						entry: weightedEntry,
						totalWeight,
					}),
					quantity: readOutputQuantity(weightedEntry.quantity),
					rollLabel: readRollLabel(entry.rolls ?? 1),
					rollSetLabel,
					sort: readOutputEntrySort(entry, weightedEntry.sort),
					sourceIndex: sourceIndex * 1000 + weightedEntryIndex,
				}),
			);
		}

		return [
			createOutputView({
				bonusLines: readOutputBonusLines({
					bonusLinesByItemId,
					itemId: entry.itemId,
					universalBonusLines,
				}),
				enabled: entry.enabled,
				effects: readDropEffects(entry.dropEffects),
				itemId: entry.itemId,
				kind: entry.type,
				ownedQuantity: readOwnedQuantity({
					itemId: entry.itemId,
					save,
				}),
				probability: readOutputProbability({
					enabled: entry.enabled,
					entry,
				}),
				quantity: readOutputQuantity(entry.quantity),
				rollSetLabel,
				sort: entry.sort,
				sourceIndex,
			}),
		];
	});

const compareOutputViews = (left: IndexedLineOutputView, right: IndexedLineOutputView) =>
	(left.sort ?? maxUnsortedOutputSort) - (right.sort ?? maxUnsortedOutputSort) ||
	left.itemId.localeCompare(right.itemId) ||
	(left.kind ?? "").localeCompare(right.kind ?? "") ||
	left.sourceIndex - right.sourceIndex;

const isZeroChanceEffectCarrier = (output: LineOutputView) =>
	output.kind === "chance" &&
	output.enabled !== false &&
	output.probability === 0 &&
	(output.effects ?? []).some((effect) => effect.impact === "chance");

const pushOutputSetViews = ({
	bonusLinesByItemId,
	outputSet,
	outputSetIndex,
	rollSetLabel,
	save,
	sourceIndexOffset,
	universalBonusLines,
}: {
	bonusLinesByItemId: ReadonlyMap<string, readonly string[]>;
	outputSet: NonNullable<EffectiveLine["lootPlan"]["outputSets"]>[number];
	outputSetIndex: number;
	rollSetLabel?: string;
	save: GameSave;
	sourceIndexOffset: number;
	universalBonusLines: readonly string[];
}) => {
	const outputs: IndexedLineOutputView[] = [];

	outputs.push(
		...collectOutputViews({
			bonusLinesByItemId,
			output: outputSet.visibleOutput,
			rollSetLabel,
			save,
			sourceIndexOffset,
			universalBonusLines,
		}),
	);

	const chanceSourceIndexOffset = sourceIndexOffset + outputSet.visibleOutput.length * 1000 + 1000;
	for (const [chanceIndex, chanceItem] of outputSet.chanceItems.entries()) {
		outputs.push(
			createOutputView({
				bonusLines: readOutputBonusLines({
					bonusLinesByItemId,
					itemId: chanceItem.itemId,
					universalBonusLines,
				}),
				enabled: true,
				effects: readDropEffects(chanceItem.dropEffects),
				itemId: chanceItem.itemId,
				kind: "chance",
				ownedQuantity: readOwnedQuantity({
					itemId: chanceItem.itemId,
					save,
				}),
				probability: chanceItem.chance,
				quantity: chanceItem.quantity ?? 1,
				rollSetLabel,
				sourceIndex: chanceSourceIndexOffset + chanceIndex,
			}),
		);
	}

	return outputs.map((output) => ({
		...output,
		sourceIndex: output.sourceIndex + outputSetIndex * 1_000_000,
	}));
};

export const readRuntimeLineOutputViews = ({
	effectBonusEntries = [],
	effectiveLine,
	save,
}: readRuntimeLineOutputViews.Props): LineOutputView[] => {
	let sourceIndexOffset = 0;
	const outputs: IndexedLineOutputView[] = [];
	const bonusLinesByItemId = readBonusLinesByItemId(effectBonusEntries);
	const universalBonusLines = readUniversalBonusLines(effectBonusEntries);
	const outputSets = effectiveLine.lootPlan.outputSets ?? [
		{
			baseOutput: effectiveLine.lootPlan.baseOutput,
			chanceItems: effectiveLine.lootPlan.chanceItems,
			visibleOutput: effectiveLine.lootPlan.visibleOutput,
			weight: 1,
		},
	];
	const totalWeight = outputSets.reduce((total, outputSet) => total + outputSet.weight, 0);

	for (const [outputSetIndex, outputSet] of outputSets.entries()) {
		outputs.push(
			...pushOutputSetViews({
				bonusLinesByItemId,
				outputSet,
				outputSetIndex,
				rollSetLabel:
					outputSets.length > 1
						? readRollSetLabel({
								outputSetIndex,
								outputSetWeight: outputSet.weight,
								totalWeight,
							})
						: undefined,
				save,
				sourceIndexOffset,
				universalBonusLines,
			}),
		);
		sourceIndexOffset += outputSet.visibleOutput.length * 1000 + outputSet.chanceItems.length + 1000;
	}

	return outputs
		.sort(compareOutputViews)
		.map(({ sourceIndex: _sourceIndex, ...output }) => output)
		.filter((output) => !isZeroChanceEffectCarrier(output));
};
