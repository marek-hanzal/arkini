import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readRuntimeStoredLineInputQuantityFromGameSave {
	export interface Props {
		itemId: string;
		lineId: string;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readRuntimeStoredLineInputQuantityFromGameSave = ({
	itemId,
	lineId,
	save,
	targetItemInstanceId,
}: readRuntimeStoredLineInputQuantityFromGameSave.Props) =>
	save.producerInputs[targetItemInstanceId]?.lineInputs[lineId]?.items[itemId] ?? 0;
