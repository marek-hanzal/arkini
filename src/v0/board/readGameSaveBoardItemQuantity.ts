import type { GameSaveBoardItem } from "~/engine/model/GameSaveShapeSchema";

export const readGameSaveBoardItemQuantity = (item: GameSaveBoardItem | undefined): number =>
	item?.quantity ?? 1;
