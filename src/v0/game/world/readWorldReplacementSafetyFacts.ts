import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readWorldReplacementSafetyFactsForItem } from "~/v0/game/world/readWorldReplacementSafetyFactsForItem";
import type { WorldReplacementSafetyFacts } from "~/v0/game/world/WorldReplacementSafetyFacts";

export namespace readWorldReplacementSafetyFacts {
	export interface Props {
		save: GameSave;
	}
}

export const readWorldReplacementSafetyFacts = ({
	save,
}: readWorldReplacementSafetyFacts.Props): WorldReplacementSafetyFacts[] =>
	Object.keys(save.board.items)
		.map((itemInstanceId) =>
			readWorldReplacementSafetyFactsForItem({
				itemInstanceId,
				save,
			}),
		)
		.sort((left, right) => left.itemInstanceId.localeCompare(right.itemInstanceId));
