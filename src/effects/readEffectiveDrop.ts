import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { applyEffectiveDropEffect } from "~/effects/applyEffectiveDropEffect";
import { shouldDisplayEffectiveDropEffect } from "~/effects/createEffectiveDropEffectOutcome";
import type { EffectiveDropEvaluation } from "~/effects/EffectiveDropEvaluation";
import type { DropEffect } from "~/effects/RuntimeLineEffectTypes";
import { readRuntimeLineEffectLabel } from "~/effects/readRuntimeLineEffectLabel";

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
}): EffectiveDropEvaluation => {
	let evaluation: EffectiveDropEvaluation = {
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
		const next = applyEffectiveDropEffect({
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
				...next.dropEffects.filter(shouldDisplayEffectiveDropEffect),
			],
			enabled: next.enabled,
			visible: next.visible,
		};
	}

	return evaluation;
};
