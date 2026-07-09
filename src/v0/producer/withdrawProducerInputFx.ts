import { Effect } from "effect";
import { checkProducerInputWithdrawReadinessFx } from "~/producer/checkProducerInputWithdrawReadinessFx";
import { withdrawProducerStoredInputFx } from "~/producer/withdrawProducerStoredInputFx";
import { placeWithdrawnActivationInputFx } from "~/activation/placeWithdrawnActivationInputFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionProducerInputWithdrawSchema } from "~/action/GameActionProducerInputWithdrawSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace withdrawProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputWithdrawSchema.Type;
		nowMs: number;
	}
}

export const withdrawProducerInputFx = Effect.fn("withdrawProducerInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: withdrawProducerInputFx.Props) {
	const checked = yield* checkProducerInputWithdrawReadinessFx({
		action,
		config,
		save,
	});
	const placement = yield* placeWithdrawnActivationInputFx({
		config,
		failureSubject: "Producer",
		itemId: action.itemId,
		nowMs,
		originItemInstanceId: action.itemInstanceId,
		quantity: checked.previousQuantity,
		reason: "producer-input-withdraw",
		save,
		seedCell: {
			x: checked.producerItem.x,
			y: checked.producerItem.y,
		},
	});

	const events: GameEvent[] = [];
	yield* withdrawProducerStoredInputFx({
		events,
		itemId: action.itemId,
		itemInstanceId: action.itemInstanceId,
		lineId: action.lineId,
		nextSave: placement.save,
		nowMs,
		previousQuantity: checked.previousQuantity,
	});
	events.push(...placement.events);
	placement.save.updatedAtMs = nowMs;

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: placement.save,
	});
});
