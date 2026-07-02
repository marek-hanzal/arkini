import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineIds } from "~/config/GameItemCapabilities";
import type { GameActionLineSetDefault } from "~/action/GameActionLineSetDefault";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkLineSetDefaultReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionLineSetDefault;
	}
}

export const checkLineSetDefaultReadinessFx = Effect.fn("checkLineSetDefaultReadinessFx")(
	function* ({ config, nowMs, save, action }: checkLineSetDefaultReadinessFx.Props) {
		const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx(
			{
				config,
				itemInstanceId: action.itemInstanceId,
				save,
			},
		);
		if (
			!readLineIds({
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
		const visibleLineIds = readVisibleLineIds({
			config,
			producerDefinition,
			itemInstanceId: action.itemInstanceId,
			nowMs,
			lineIds: readLineIds({
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
	},
);
