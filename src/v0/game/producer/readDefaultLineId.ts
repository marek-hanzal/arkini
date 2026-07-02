import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readDefaultLineId {
	export interface Props {
		lineIds: readonly string[];
		itemInstanceId: string;
		save: GameSave;
	}
}

export const readDefaultLineId = ({ lineIds, itemInstanceId, save }: readDefaultLineId.Props) => {
	const savedDefaultLineId = save.lines[itemInstanceId]?.defaultLineId;
	if (savedDefaultLineId && lineIds.includes(savedDefaultLineId)) {
		return savedDefaultLineId;
	}

	return undefined;
};
