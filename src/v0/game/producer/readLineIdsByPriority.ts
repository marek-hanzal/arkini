import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readDefaultEffectLineId } from "~/v0/game/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/v0/game/producer/readDefaultLineId";

export namespace readLineIdsByPriority {
	export interface Props {
		lineIds: readonly string[];
		itemInstanceId: string;
		save: GameSave;
	}
}

export const readLineIdsByPriority = ({
	lineIds,
	itemInstanceId,
	save,
}: readLineIdsByPriority.Props) => {
	const defaultEffectLineId = readDefaultEffectLineId({
		lineIds,
		itemInstanceId,
		save,
	});
	const defaultLineId = readDefaultLineId({
		lineIds,
		itemInstanceId,
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
