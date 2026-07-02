import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readDefaultEffectLineId {
	export interface Props {
		lineIds: readonly string[];
		itemInstanceId: string;
		save: GameSave;
	}
}

export const readDefaultEffectLineId = ({
	lineIds,
	itemInstanceId,
	save,
}: readDefaultEffectLineId.Props) => {
	const savedDefaultLineId = save.lines[itemInstanceId]?.defaultEffectLineId;
	if (savedDefaultLineId && lineIds.includes(savedDefaultLineId)) {
		return savedDefaultLineId;
	}

	return undefined;
};
