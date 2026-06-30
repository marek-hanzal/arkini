import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldReplacementSafetyFactsForItem } from "~/v0/game/world/readWorldReplacementSafetyFactsForItem";

export const readBoardItemRuntimeStateStatus = ({
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
	const craftBusy = facts.blockReasons.includes("craft_job");
	const producerBusy = facts.blockReasons.includes("producer_job");

	return {
		busy: producerBusy || craftBusy,
		craftBusy,
		preservable: facts.blockReasons.some(
			(reason) => reason !== "craft_job" && reason !== "producer_job",
		),
		producerBusy,
	};
};
