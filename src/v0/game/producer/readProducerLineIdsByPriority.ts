import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerDefaultEffectLineId } from "~/v0/game/producer/readProducerDefaultEffectLineId";
import { readProducerDefaultLineId } from "~/v0/game/producer/readProducerDefaultLineId";

export namespace readProducerLineIdsByPriority {
	export interface Props {
		lineIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerLineIdsByPriority = ({
	lineIds,
	producerItemInstanceId,
	save,
}: readProducerLineIdsByPriority.Props) => {
	const defaultEffectLineId = readProducerDefaultEffectLineId({
		lineIds,
		producerItemInstanceId,
		save,
	});
	const defaultLineId = readProducerDefaultLineId({
		lineIds,
		producerItemInstanceId,
		save,
	});
	const defaultLineIds = [
		defaultEffectLineId,
		defaultLineId,
	].filter((lineId): lineId is string => Boolean(lineId));

	if (defaultLineIds.length === 0) {
		return [
			...lineIds,
		];
	}

	return [
		...defaultLineIds,
		...lineIds.filter((lineId) => !defaultLineIds.includes(lineId)),
	];
};
