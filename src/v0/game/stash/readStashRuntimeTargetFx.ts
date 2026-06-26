import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";

export namespace readStashRuntimeTargetFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashRuntimeTargetFx = Effect.fn("readStashRuntimeTargetFx")(function* ({
	config,
	save,
	stashItemInstanceId,
}: readStashRuntimeTargetFx.Props) {
	const stashItem = yield* readStashBoardItemFx({
		config,
		save,
		stashItemInstanceId,
	});
	const stashId = stashItem.itemId;
	const stash = config.stashes[stashId];
	if (!stash) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Item "${stashItem.itemId}" is not a stash.`),
		);
	}

	return {
		output: stash.output,
		stash,
		stashId,
		stashItem,
	};
});
