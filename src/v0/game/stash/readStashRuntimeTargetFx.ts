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
	const stashId = config.items[stashItem.itemId]?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Stash item "${stashItem.itemId}" references missing stash.`,
			),
		);
	}

	const lootTable = config.lootTables[stash.outputTableId];
	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${stash.outputTableId}".`),
		);
	}

	return {
		lootTable,
		stash,
		stashId,
		stashItem,
	};
});
