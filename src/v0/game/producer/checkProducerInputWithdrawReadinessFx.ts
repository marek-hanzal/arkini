import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerProductLineDefinition,
	readProducerProductLineIds,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameActionProducerInputWithdraw } from "~/v0/game/action/GameActionProducerInputWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerInputWithdrawReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputWithdraw;
	}
}

export const checkProducerInputWithdrawReadinessFx = Effect.fn(
	"checkProducerInputWithdrawReadinessFx",
)(function* ({ config, save, action }: checkProducerInputWithdrawReadinessFx.Props) {
	const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	if (
		!readProducerProductLineIds({
			producerDefinition,
		}).includes(action.productId)
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerId}".`,
			),
		);
	}

	const inputSlot = readProducerProductLineDefinition({
		producerDefinition,
		productId: action.productId,
	})?.inputs?.find((input) => input.itemId === action.itemId);
	if (!inputSlot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Product "${action.productId}" has no input "${action.itemId}".`,
			),
		);
	}

	const previousQuantity =
		save.producerInputs[action.producerItemInstanceId]?.productInputs[action.productId]?.items[
			action.itemId
		] ?? 0;
	if (previousQuantity <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Producer input "${action.itemId}" is not stored for product "${action.productId}".`,
			),
		);
	}

	return {
		inputSlot,
		nextQuantity: 0,
		previousQuantity,
		producerDefinition,
		producerItem,
	};
});
