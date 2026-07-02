import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerDefaultLineId {
	export interface Props {
		lineIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDefaultLineId = ({
	lineIds,
	producerItemInstanceId,
	save,
}: readProducerDefaultLineId.Props) => {
	const savedDefaultLineId = save.producerLines[producerItemInstanceId]?.defaultLineId;
	if (savedDefaultLineId && lineIds.includes(savedDefaultLineId)) {
		return savedDefaultLineId;
	}

	return undefined;
};
