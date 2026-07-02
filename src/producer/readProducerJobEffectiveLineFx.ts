import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import { readProducerCapabilityDefinition } from "~/config/readProducerCapabilityDefinition";

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
