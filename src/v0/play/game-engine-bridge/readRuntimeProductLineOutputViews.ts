import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";

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

const readOwnedQuantity = ({ itemId, save }: { itemId: string; save: GameSave }) =>
	readGameSaveItemQuantityByScope({
		itemId,
		save,
		scope: "board_or_inventory",
	});

const createOutputView = ({
	itemId,
	kind,
	ownedQuantity,
	probability,
	quantity,
	rollLabel,
	sort,
	sourceIndex,
}: IndexedProductLineOutputView): IndexedProductLineOutputView => ({
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

const collectOutputViews = ({
	output,
	probabilityMultiplier,
	save,
	sourceIndexOffset,
}: {
	output: ProductOutput;
	probabilityMultiplier: number;
	save: GameSave;
	sourceIndexOffset: number;
}): IndexedProductLineOutputView[] =>
	output.flatMap((entry, outputIndex): IndexedProductLineOutputView[] => {
		const sourceIndex = sourceIndexOffset + outputIndex;

		if (entry.type === "weighted") {
			return entry.entries.map((weightedEntry, weightedEntryIndex) =>
				createOutputView({
					itemId: weightedEntry.itemId,
					kind: "weighted",
					ownedQuantity: readOwnedQuantity({
						itemId: weightedEntry.itemId,
						save,
					}),
					probability: probabilityMultiplier < 1 ? probabilityMultiplier : undefined,
					quantity: readOutputQuantity(weightedEntry.quantity),
					rollLabel: readRollLabel(entry.rolls ?? 1),
					sort: readOutputEntrySort(entry, weightedEntry.sort),
					sourceIndex: sourceIndex * 1000 + weightedEntryIndex,
				}),
			);
		}

		return [
			createOutputView({
				itemId: entry.itemId,
				kind: entry.type,
				ownedQuantity: readOwnedQuantity({
					itemId: entry.itemId,
					save,
				}),
				probability:
					entry.type === "chance" || probabilityMultiplier < 1
						? probabilityMultiplier * (entry.type === "chance" ? entry.chance : 1)
						: undefined,
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
			output: effectiveProductLine.lootPlan.baseOutput,
			probabilityMultiplier: effectiveProductLine.lootPlan.baseDropChance,
			save,
			sourceIndexOffset,
		}),
	);
	sourceIndexOffset += effectiveProductLine.lootPlan.baseOutput.length * 1000 + 1000;

	for (const appendOutput of effectiveProductLine.lootPlan.appendOutputs) {
		outputs.push(
			...collectOutputViews({
				output: appendOutput.output,
				probabilityMultiplier: appendOutput.chance,
				save,
				sourceIndexOffset,
			}),
		);
		sourceIndexOffset += appendOutput.output.length * 1000 + 1000;
	}

	for (const [chanceIndex, chanceItem] of effectiveProductLine.lootPlan.chanceItems.entries()) {
		outputs.push(
			createOutputView({
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
