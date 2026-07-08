import type { LineView } from "~/board/view/LineViewSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveLine } from "~/effects/EffectiveLine";
import {
	compareOutputViews,
	isZeroChanceEffectCarrier,
	pushOutputSetViews,
	readBonusLinesByItemId,
	readRollSetLabel,
	readUniversalBonusLines,
	type IndexedLineOutputView,
} from "~/play/game-engine-bridge/readRuntimeLineOutputViewHelpers";
import type { RuntimeLineActiveEffectBonusEntry } from "~/play/game-engine-bridge/readRuntimeEffectOperationSummary";

type LineOutputView = NonNullable<LineView["outputs"]>[number];

export namespace readRuntimeLineOutputViews {
	export interface Props {
		effectBonusEntries?: readonly RuntimeLineActiveEffectBonusEntry[];
		effectiveLine: EffectiveLine;
		save: GameSave;
	}
}

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
		sourceIndexOffset +=
			outputSet.visibleOutput.length * 1000 + outputSet.chanceItems.length + 1000;
	}

	return outputs
		.sort(compareOutputViews)
		.map(({ sourceIndex: _sourceIndex, ...output }) => output)
		.filter((output) => !isZeroChanceEffectCarrier(output));
};
