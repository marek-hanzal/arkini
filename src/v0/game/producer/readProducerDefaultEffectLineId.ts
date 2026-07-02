import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerDefaultEffectLineId {
	export interface Props {
		lineIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDefaultEffectLineId = ({
	lineIds,
	producerItemInstanceId,
	save,
}: readProducerDefaultEffectLineId.Props) => {
	const savedDefaultLineId = save.producerLines[producerItemInstanceId]?.defaultEffectLineId;
	if (savedDefaultLineId && lineIds.includes(savedDefaultLineId)) {
		return savedDefaultLineId;
	}

	return undefined;
};
