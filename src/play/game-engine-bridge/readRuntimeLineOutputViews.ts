import type { LineView } from "~/board/view/LineViewSchema";
import { readGameSaveItemQuantityByScope } from "~/activation/readGameSaveItemQuantityByScope";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveDropEffectOutcome, EffectiveLine } from "~/effects/EffectiveLine";

type LineOutput = NonNullable<GameLineDefinition["output"]>;
type LineOutputEntry = LineOutput[number];
type LineOutputView = NonNullable<LineView["outputs"]>[number];
type LineOutputQuantity = NonNullable<LineOutputView["quantity"]>;

interface IndexedLineOutputView extends LineOutputView {
	readonly sourceIndex: number;
}

export namespace readRuntimeLineOutputViews {
	export interface Props {
		effectiveLine: EffectiveLine;
		save: GameSave;
	}
}

const maxUnsortedOutputSort = Number.MAX_SAFE_INTEGER;

const readOutputQuantity = (quantity: LineOutputQuantity | undefined): LineOutputQuantity =>
	quantity ?? 1;

const readOutputEntrySort = (output: LineOutputEntry, entrySort?: number) =>
	entrySort ?? output.sort;

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
	enabled,
	effects,
	itemId,
	kind,
	ownedQuantity,
	probability,
	quantity,
	rollLabel,
	sort,
	sourceIndex,
}: IndexedLineOutputView): IndexedLineOutputView => ({
	enabled,
	effects,
	itemId,
	kind,
	ownedQuantity,
	probability,
	quantity,
	rollLabel,
	sort,
	sourceIndex,
});

const readRollLabel = (rolls: LineOutputQuantity) => {
	if (typeof rolls !== "number") return `weighted · ${rolls.min}-${rolls.max} rolls`;
	return rolls > 1 ? `weighted · ${rolls} rolls` : "weighted roll";
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
	output,
	save,
	sourceIndexOffset,
}: {
	output: EffectiveLine["lootPlan"]["visibleOutput"];
	save: GameSave;
	sourceIndexOffset: number;
}): IndexedLineOutputView[] =>
	output.flatMap((entry, outputIndex): IndexedLineOutputView[] => {
		const sourceIndex = sourceIndexOffset + outputIndex;

		if (entry.type === "weighted") {
			const totalWeight = readWeightedOutputTotalWeight(entry.entries);
			return entry.entries.map((weightedEntry, weightedEntryIndex) =>
				createOutputView({
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
					sort: readOutputEntrySort(entry, weightedEntry.sort),
					sourceIndex: sourceIndex * 1000 + weightedEntryIndex,
				}),
			);
		}

		return [
			createOutputView({
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

export const readRuntimeLineOutputViews = ({
	effectiveLine,
	save,
}: readRuntimeLineOutputViews.Props): LineOutputView[] => {
	let sourceIndexOffset = 0;
	const outputs: IndexedLineOutputView[] = [];

	outputs.push(
		...collectOutputViews({
			output: effectiveLine.lootPlan.visibleOutput,
			save,
			sourceIndexOffset,
		}),
	);
	sourceIndexOffset += effectiveLine.lootPlan.visibleOutput.length * 1000 + 1000;

	for (const [chanceIndex, chanceItem] of effectiveLine.lootPlan.chanceItems.entries()) {
		outputs.push(
			createOutputView({
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
				sourceIndex: sourceIndexOffset + chanceIndex,
			}),
		);
	}

	return outputs
		.sort(compareOutputViews)
		.map(({ sourceIndex: _sourceIndex, ...output }) => output)
		.filter((output) => !isZeroChanceEffectCarrier(output));
};
