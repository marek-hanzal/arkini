import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldReplacementSafetyFactsForItem } from "~/world/readWorldReplacementSafetyFactsForItem";
import type { WorldReplacementSafetyFacts } from "~/world/WorldReplacementSafetyFacts";

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
