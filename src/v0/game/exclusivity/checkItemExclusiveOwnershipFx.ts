import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveExclusiveConflicts } from "~/v0/game/exclusivity/readGameSaveExclusiveConflicts";

export namespace checkItemExclusiveOwnershipFx {
	export interface Props {
		config: GameConfig;
		itemId: string;
		save: GameSave;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
	}
}

export const checkItemExclusiveOwnershipFx = Effect.fn("checkItemExclusiveOwnershipFx")(function* ({
	config,
	ignoredBoardItemInstanceIds,
	itemId,
	save,
}: checkItemExclusiveOwnershipFx.Props) {
	const conflicts = readGameSaveExclusiveConflicts({
		config,
		ignoredBoardItemInstanceIds,
		itemId,
		save,
	});
	if (conflicts.length === 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"exclusive_conflict",
			`Item "${itemId}" cannot coexist with "${conflicts.join('", "')}".`,
		),
	);
});
