import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readVisibleProducerLineIds } from "~/v0/game/producer/readVisibleProducerLineIds";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerLineIds } from "~/v0/game/config/GameItemCapabilities";
import type { GameActionProducerLineSetDefault } from "~/v0/game/action/GameActionProducerLineSetDefault";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerLineSetDefaultReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerLineSetDefault;
	}
}

export const checkProducerLineSetDefaultReadinessFx = Effect.fn(
	"checkProducerLineSetDefaultReadinessFx",
)(function* ({ config, nowMs, save, action }: checkProducerLineSetDefaultReadinessFx.Props) {
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
				`Line "${action.lineId}" does not belong to producer "${producerId}" on item "${producerItem.itemId}".`,
			),
		);
	}
	const visibleLineIds = readVisibleProducerLineIds({
		config,
		producerDefinition,
		producerItemInstanceId: action.producerItemInstanceId,
		nowMs,
		lineIds: readProducerLineIds({
			producerDefinition,
		}),
		save,
	});
	if (!visibleLineIds.includes(action.lineId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${action.lineId}" is hidden for the current game state.`,
			),
		);
	}

	return {
		producerDefinition,
		producerItem,
	};
});
