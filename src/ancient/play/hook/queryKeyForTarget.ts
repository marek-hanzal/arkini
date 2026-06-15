import { databaseStatusQueryKey } from "./databaseStatusQueryKey";
import type { PlayDataInvalidationTarget } from "./PlayDataInvalidationTarget";
import { playQueryKeys } from "./playQueryKeys";

export const queryKeyForTarget = (target: PlayDataInvalidationTarget) => {
	switch (target) {
		case "all":
			return playQueryKeys.all;
		case "save":
			return playQueryKeys.save;
		case "items":
			return playQueryKeys.items;
		case "board":
			return playQueryKeys.board;
		case "inventory":
			return playQueryKeys.inventory;
		case "upgrades":
			return playQueryKeys.upgrades;
		case "databaseStatus":
			return databaseStatusQueryKey;
	}
};
