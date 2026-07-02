import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readLineDefinition, readLineIds } from "~/v0/game/config/GameItemCapabilities";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";

export namespace readProducerJobEffectiveLineFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs: number;
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const readProducerJobEffectiveLineFx = Effect.fn("readProducerJobEffectiveLineFx")(
	function* ({
		config,
		ignoredProducerJobIds,
		nowMs,
		itemInstanceId,
		lineId,
		save,
	}: readProducerJobEffectiveLineFx.Props) {
		const producerItem = save.board.items[itemInstanceId];
		if (!producerItem) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Producer job target "${itemInstanceId}" must be a board item.`,
				),
			);
		}

		const producerDefinition = readProducerCapabilityDefinition({
			config,
			producerId: producerItem.itemId,
		});
		if (!producerDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing producer-like capability definition "${producerItem.itemId}".`,
				),
			);
		}
		if (
			!readLineIds({
				producerDefinition,
			}).includes(lineId)
		) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Line "${lineId}" does not belong to producer-like capability "${producerItem.itemId}".`,
				),
			);
		}

		const line = readLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing line "${lineId}".`),
			);
		}

		return readEffectiveLine({
			baseDurationMs: readLineDurationMs({
				line,
			}),
			config,
			ignoredProducerJobIds,
			nowMs,
			itemInstanceId,
			line,
			lineId,
			save,
		});
	},
);
