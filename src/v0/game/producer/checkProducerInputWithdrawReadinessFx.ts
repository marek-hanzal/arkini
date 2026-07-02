import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerLineDefinition,
	readProducerLineIds,
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
		!readProducerLineIds({
			producerDefinition,
		}).includes(action.lineId)
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${action.lineId}" does not belong to producer "${producerId}".`,
			),
		);
	}

	const inputSlot = readProducerLineDefinition({
		producerDefinition,
		lineId: action.lineId,
	})?.inputs?.find((input) => input.itemId === action.itemId);
	if (!inputSlot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Line "${action.lineId}" has no input "${action.itemId}".`,
			),
		);
	}

	const previousQuantity =
		save.producerInputs[action.producerItemInstanceId]?.lineInputs[action.lineId]?.items[
			action.itemId
		] ?? 0;
	if (previousQuantity <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Producer input "${action.itemId}" is not stored for producer line "${action.lineId}".`,
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
