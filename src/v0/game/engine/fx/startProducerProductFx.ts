import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeProductInputsFx } from "~/v0/game/engine/fx/consumeProductInputsFx";
import { createGameJobIdFx } from "~/v0/game/engine/fx/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { readProducerBoardItemFx } from "~/v0/game/engine/fx/readProducerBoardItemFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/engine/model/GameActionProducerProductStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace startProducerProductFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductStart;
		nowMs: number;
	}
}

export const startProducerProductFx = Effect.fn("startProducerProductFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: startProducerProductFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	const producerDefinition =
		config.producers[config.items[producerItem.itemId]?.producerId ?? ""];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Producer item "${producerItem.itemId}" references missing producer.`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}

	const product = config.products[action.productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${action.productId}".`),
		);
	}

	yield* checkGameRequirementsFx({
		config,
		requirements: producerDefinition.requirements,
		save,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: product.requirements,
		save,
	});

	const consumed = yield* consumeProductInputsFx({
		inputRefs: action.inputRefs,
		inputs: product.inputs,
		nowMs,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const jobId = yield* createGameJobIdFx({
		save: nextSave,
	});
	const completesAtMs = nowMs + product.durationMs;
	nextSave.producerJobs[jobId] = {
		completesAtMs,
		id: jobId,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: action.productId,
		startedAtMs: nowMs,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				completesAtMs,
				jobId,
				producerItemInstanceId: action.producerItemInstanceId,
				productId: action.productId,
				startedAtMs: nowMs,
				type: "product.started" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
