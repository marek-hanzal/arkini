import type { GameSave } from "~/engine/model/GameSaveSchema";

export interface GameEffectSourceCell {
	x: number;
	y: number;
}

export namespace readGameEffectSourceCell {
	export interface Props {
		save: GameSave;
		sourceItemInstanceId: string;
	}
}

export const readGameEffectSourceCell = ({
	save,
	sourceItemInstanceId,
}: readGameEffectSourceCell.Props): GameEffectSourceCell | undefined => {
	const boardItem = save.board.items[sourceItemInstanceId];
	if (!boardItem) return undefined;

	return {
		x: boardItem.x,
		y: boardItem.y,
	};
};
