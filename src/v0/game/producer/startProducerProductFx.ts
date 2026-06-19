import { Effect } from "effect";
import { checkProducerProductStartReadinessFx } from "~/v0/game/producer/checkProducerProductStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/engine/model/GameActionProducerProductStart";
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
	const checked = yield* checkProducerProductStartReadinessFx({
		action,
		config,
		save,
	});
	const consumed = action.inputRefs.length
		? yield* consumeActivationInputsFx({
				inputRefs: action.inputRefs,
				inputs: checked.productInputs,
				nowMs,
				reason: "product-input",
				save,
			})
		: {
				events: [],
				save,
			};
	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	if (action.inputRefs.length === 0) {
		yield* consumeProducerStoredInputsFx({
			inputs: checked.productInputs,
			nextSave,
			producerItemInstanceId: action.producerItemInstanceId,
			productId: action.productId,
		});
	}
	const jobId = yield* createGameJobIdFx();
	const queuedStartAtMs = Math.max(
		nowMs,
		...Object.values(nextSave.producerJobs)
			.filter((job) => job.producerItemInstanceId === action.producerItemInstanceId)
			.map((job) => job.completesAtMs),
	);
	const completesAtMs = queuedStartAtMs + checked.product.durationMs;
	nextSave.producerJobs[jobId] = {
		completesAtMs,
		id: jobId,
		outputTableId: checked.product.outputTableId ?? null,
		placement: checked.product.placement,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: action.productId,
		startedAtMs: queuedStartAtMs,
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
				startedAtMs: queuedStartAtMs,
				type: "product.started" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
