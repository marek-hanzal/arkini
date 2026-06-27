import { Effect } from "effect";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";
import { startProducerProductFx } from "~/v0/game/producer/startProducerProductFx";

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
	const stash = config.stashes[stashItem.itemId];
	const productId = stash?.productIds[0];
	if (!stash || !productId) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Item "${stashItem.itemId}" is not a valid stash producer capability.`,
			),
		);
	}

	return yield* startProducerProductFx({
		action: {
			inputRefs: action.inputRefs,
			producerItemInstanceId: action.stashItemInstanceId,
			productId,
			type: "producer.product.start",
		},
		config,
		nowMs,
		save,
	});
});
