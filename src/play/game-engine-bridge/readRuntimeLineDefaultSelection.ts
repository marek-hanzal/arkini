import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readDefaultEffectLineId } from "~/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/producer/readDefaultLineId";

export type RuntimeLineDefaultSelection = {
	readonly selectedDefaultEffectLineId?: string;
	readonly selectedDefaultProductLineId?: string;
};

export namespace readRuntimeLineDefaultSelection {
	export interface Props {
		itemInstanceId: string;
		save: GameSave;
		visibleLineIds: readonly string[];
	}
}

export const readRuntimeLineDefaultSelection = ({
	itemInstanceId,
	save,
	visibleLineIds,
}: readRuntimeLineDefaultSelection.Props): RuntimeLineDefaultSelection => ({
	selectedDefaultEffectLineId: readDefaultEffectLineId({
		lineIds: visibleLineIds,
		itemInstanceId,
		save,
	}),
	selectedDefaultProductLineId: readDefaultLineId({
		lineIds: visibleLineIds,
		itemInstanceId,
		save,
	}),
});
