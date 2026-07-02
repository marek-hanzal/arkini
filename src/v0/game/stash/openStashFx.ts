import { Effect } from "effect";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { startLineFx } from "~/v0/game/producer/startLineFx";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";

export namespace openStashFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStashOpen;
		nowMs: number;
	}
}

export const openStashFx = Effect.fn("openStashFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: openStashFx.Props) {
	const stashItem = yield* readStashBoardItemFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	const stash = config.items[stashItem.itemId]?.stash;
	const lineId = stash?.line.id;
	if (!stash || !lineId) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Item "${stashItem.itemId}" is not a valid stash producer capability.`,
			),
		);
	}

	return yield* startLineFx({
		action: {
			inputRefs: action.inputRefs,
			itemInstanceId: action.stashItemInstanceId,
			lineId,
			type: "line.start",
		},
		config,
		nowMs,
		save,
	});
});
