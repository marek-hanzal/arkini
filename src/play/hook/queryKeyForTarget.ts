import { match } from "ts-pattern";
import { databaseStatusQueryKey } from "./databaseStatusQueryKey";
import type { PlayDataInvalidationTarget } from "./PlayDataInvalidationTarget";
import { playQueryKeys } from "./playQueryKeys";

export const queryKeyForTarget = (target: PlayDataInvalidationTarget) =>
	match(target)
		.with("all", () => playQueryKeys.all)
		.with("save", () => playQueryKeys.save)
		.with("items", () => playQueryKeys.items)
		.with("board", () => playQueryKeys.board)
		.with("inventory", () => playQueryKeys.inventory)
		.with("upgrades", () => playQueryKeys.upgrades)
		.with("databaseStatus", () => databaseStatusQueryKey)
		.exhaustive();
