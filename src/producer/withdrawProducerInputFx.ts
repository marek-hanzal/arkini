import { Effect } from "effect";
import { checkProducerInputWithdrawReadinessFx } from "~/producer/checkProducerInputWithdrawReadinessFx";
import { placeWithdrawnActivationInputFx } from "~/activation/placeWithdrawnActivationInputFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionProducerInputWithdrawSchema } from "~/action/GameActionProducerInputWithdrawSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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

	const producerInputState = placement.save.producerInputs[action.itemInstanceId];
	const lineInputState = producerInputState?.lineInputs[action.lineId];
	if (lineInputState) {
		delete lineInputState.items[action.itemId];
		if (Object.keys(lineInputState.items).length === 0) {
			delete producerInputState.lineInputs[action.lineId];
		}
		if (Object.keys(producerInputState.lineInputs).length === 0) {
			delete placement.save.producerInputs[action.itemInstanceId];
		}
	}
	placement.save.updatedAtMs = nowMs;

	const events: GameEvent[] = [
		{
			itemId: action.itemId,
			nextQuantity: 0,
			previousQuantity: checked.previousQuantity,
			itemInstanceId: action.itemInstanceId,
			lineId: action.lineId,
			quantity: checked.previousQuantity,
			type: "producer_input.withdrawn",
			atMs: nowMs,
		},
		...placement.events,
	];

	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: placement.save,
	});
});
