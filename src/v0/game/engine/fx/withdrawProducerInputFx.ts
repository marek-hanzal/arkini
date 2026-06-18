import { Effect } from "effect";
import { checkProducerInputWithdrawReadinessFx } from "~/v0/game/engine/fx/checkProducerInputWithdrawReadinessFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerInputWithdraw } from "~/v0/game/engine/model/GameActionProducerInputWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace withdrawProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputWithdraw;
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
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: [
			{
				itemId: action.itemId,
				originItemInstanceId: action.producerItemInstanceId,
				quantity: checked.previousQuantity,
				reason: "producer-input-withdraw",
			},
		],
		nowMs,
		save,
		seedCell: {
			x: checked.producerItem.x,
			y: checked.producerItem.y,
		},
	});
	if (placement.type === "blocked") {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"placement_unavailable",
				`Producer input "${action.itemId}" cannot be withdrawn because there is no placement space.`,
			),
		);
	}

	const producerInputState = placement.save.producerInputs[action.producerItemInstanceId];
	const productInputState = producerInputState?.productInputs[action.productId];
	if (productInputState) {
		delete productInputState.items[action.itemId];
		if (Object.keys(productInputState.items).length === 0) {
			delete producerInputState.productInputs[action.productId];
		}
		if (Object.keys(producerInputState.productInputs).length === 0) {
			delete placement.save.producerInputs[action.producerItemInstanceId];
		}
	}
	placement.save.updatedAtMs = nowMs;

	const events: GameEvent[] = [
		{
			itemId: action.itemId,
			nextQuantity: 0,
			previousQuantity: checked.previousQuantity,
			producerItemInstanceId: action.producerItemInstanceId,
			productId: action.productId,
			quantity: checked.previousQuantity,
			type: "producer_input.withdrawn",
			withdrawnAtMs: nowMs,
		},
		...placement.events,
	];

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: placement.save,
		}),
		save: placement.save,
	} satisfies GameEngineResult;
});
