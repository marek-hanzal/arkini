import { Effect } from "effect";
import { checkProducerInputStoreReadinessFx } from "~/producer/checkProducerInputStoreReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { storeProducerResolvedInputFx } from "~/producer/storeProducerResolvedInputFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace storeProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputStoreSchema.Type;
		nowMs: number;
	}
}

export const storeProducerInputFx = Effect.fn("storeProducerInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: storeProducerInputFx.Props) {
	const checked = yield* checkProducerInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "producer-input-store",
		ref: checked.resolvedRef,
	});

	yield* storeProducerResolvedInputFx({
		events,
		itemInstanceId: action.itemInstanceId,
		lineId: checked.lineId,
		nextSave,
		nowMs,
		ref: checked.resolvedRef,
	});
	nextSave.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: nextSave,
	});
});
