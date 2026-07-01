import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readGameSaveItemQuantityByScope } from "~/v0/game/activation/readGameSaveItemQuantityByScope";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type {
	EffectiveDropEffectOutcome,
	EffectiveProducerProductLine,
} from "~/v0/game/effects/EffectiveProducerProductLine";

type ProductOutput = NonNullable<GameConfig["products"][string]["output"]>;
type ProductOutputEntry = ProductOutput[number];
type ProductLineOutputView = NonNullable<ProducerProductLineView["outputs"]>[number];
type ProductLineOutputQuantity = NonNullable<ProductLineOutputView["quantity"]>;

interface IndexedProductLineOutputView extends ProductLineOutputView {
	readonly sourceIndex: number;
}

export namespace readRuntimeProductLineOutputViews {
	export interface Props {
		effectiveProductLine: EffectiveProducerProductLine;
		save: GameSave;
	}
}

const maxUnsortedOutputSort = Number.MAX_SAFE_INTEGER;

const readOutputQuantity = (
	quantity: ProductLineOutputQuantity | undefined,
): ProductLineOutputQuantity => quantity ?? 1;

const readOutputEntrySort = (output: ProductOutputEntry, entrySort?: number) =>
	entrySort ?? output.sort;

const readOutputProbability = ({
	enabled,
	entry,
}: {
	enabled?: boolean;
	entry: Extract<
		ProductOutputEntry,
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
}: IndexedProductLineOutputView): IndexedProductLineOutputView => ({
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

const readRollLabel = (rolls: ProductLineOutputQuantity) => {
	if (typeof rolls !== "number") return `weighted · ${rolls.min}-${rolls.max} rolls`;
	return rolls > 1 ? `weighted · ${rolls} rolls` : "weighted roll";
};

const readWeightedOutputTotalWeight = (
	entries: Extract<
		EffectiveProducerProductLine["lootPlan"]["visibleOutput"][number],
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
		EffectiveProducerProductLine["lootPlan"]["visibleOutput"][number],
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
	output: EffectiveProducerProductLine["lootPlan"]["visibleOutput"];
	save: GameSave;
	sourceIndexOffset: number;
}): IndexedProductLineOutputView[] =>
	output.flatMap((entry, outputIndex): IndexedProductLineOutputView[] => {
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

const compareOutputViews = (
	left: IndexedProductLineOutputView,
	right: IndexedProductLineOutputView,
) =>
	(left.sort ?? maxUnsortedOutputSort) - (right.sort ?? maxUnsortedOutputSort) ||
	left.itemId.localeCompare(right.itemId) ||
	(left.kind ?? "").localeCompare(right.kind ?? "") ||
	left.sourceIndex - right.sourceIndex;

export const readRuntimeProductLineOutputViews = ({
	effectiveProductLine,
	save,
}: readRuntimeProductLineOutputViews.Props): ProductLineOutputView[] => {
	let sourceIndexOffset = 0;
	const outputs: IndexedProductLineOutputView[] = [];

	outputs.push(
		...collectOutputViews({
			output: effectiveProductLine.lootPlan.visibleOutput,
			save,
			sourceIndexOffset,
		}),
	);
	sourceIndexOffset += effectiveProductLine.lootPlan.visibleOutput.length * 1000 + 1000;

	for (const [chanceIndex, chanceItem] of effectiveProductLine.lootPlan.chanceItems.entries()) {
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
		.map(({ sourceIndex: _sourceIndex, ...output }) => output);
};
