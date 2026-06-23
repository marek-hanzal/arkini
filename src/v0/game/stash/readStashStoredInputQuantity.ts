import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readStashStoredInputQuantity {
	export interface Props {
		itemId: string;
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashStoredInputQuantity = ({
	itemId,
	save,
	stashItemInstanceId,
}: readStashStoredInputQuantity.Props) =>
	save.stashInputs[stashItemInstanceId]?.items[itemId] ?? 0;
