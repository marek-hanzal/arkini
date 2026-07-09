import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import type { GameActionProducerInputWithdrawSchema } from "~/action/GameActionProducerInputWithdrawSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkProducerInputWithdrawReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputWithdrawSchema.Type;
	}
}

export const checkProducerInputWithdrawReadinessFx = Effect.fn(
	"checkProducerInputWithdrawReadinessFx",
)(function* ({ config, save, action }: checkProducerInputWithdrawReadinessFx.Props) {
	const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx({
		config,
		itemInstanceId: action.itemInstanceId,
		save,
	});
	if (
		!readLineIds({
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

	const inputSlot = readLineDefinition({
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
		save.producerInputs[action.itemInstanceId]?.lineInputs[action.lineId]?.items[
			action.itemId
		] ?? 0;
	if (previousQuantity <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Producer input "${action.itemId}" is not stored for line "${action.lineId}".`,
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
