import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldReplacementSafetyFactsForItem } from "~/world/readWorldReplacementSafetyFactsForItem";

export const isBoardItemConsumableAsInput = ({
	itemInstanceId,
	save,
}: {
	itemInstanceId: string;
	save: GameSave;
}) => {
	const facts = readWorldReplacementSafetyFactsForItem({
		itemInstanceId,
		save,
	});

	return facts.blockReasons.every((reason) => reason === "producer_line_state");
};
