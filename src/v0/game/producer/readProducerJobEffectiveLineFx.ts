import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerLineDefinition,
	readProducerLineIds,
} from "~/v0/game/config/GameItemCapabilities";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";

export namespace readProducerJobEffectiveLineFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs: number;
		producerItemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const readProducerJobEffectiveLineFx = Effect.fn("readProducerJobEffectiveLineFx")(
	function* ({
		config,
		ignoredProducerJobIds,
		nowMs,
		producerItemInstanceId,
		lineId,
		save,
	}: readProducerJobEffectiveLineFx.Props) {
		const producerItem = save.board.items[producerItemInstanceId];
		if (!producerItem) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Producer job target "${producerItemInstanceId}" must be a board item.`,
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
			!readProducerLineIds({
				producerDefinition,
			}).includes(lineId)
		) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Line "${lineId}" does not belong to producer-like capability "${producerItem.itemId}".`,
				),
			);
		}

		const line = readProducerLineDefinition({
			producerDefinition,
			lineId,
		});
		if (!line) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing producer line "${lineId}".`),
			);
		}

		return readEffectiveProducerLine({
			baseDurationMs: readProducerLineDurationMs({
				line,
			}),
			config,
			ignoredProducerJobIds,
			nowMs,
			producerItemInstanceId,
			line,
			lineId,
			save,
		});
	},
);
