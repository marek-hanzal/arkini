import { Effect } from "effect";
import { autoFillProducerProductInputsFx } from "~/v0/game/producer/autoFillProducerProductInputsFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/producer/checkProducerProductStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/action/GameActionProducerProductStart";
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

const readProducerStoredInputsReadyFx = Effect.fn("readProducerStoredInputsReadyFx")(function* ({
	inputs,
	save,
	producerItemInstanceId,
	productId,
}: {
	inputs: readonly GameActivationInput[];
	save: GameSave;
	producerItemInstanceId: string;
	productId: string;
}) {
	const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
		producerItemInstanceId,
		productId,
		save,
	});
	return inputs.every((input) => (storedInputs.get(input.itemId) ?? 0) >= input.quantity);
});

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
		yield* autoFillProducerProductInputsFx({
			events: consumed.events,
			inputs: checked.productInputs,
			nextSave,
			nowMs,
			producerItemInstanceId: action.producerItemInstanceId,
			productId: checked.productId,
		});
		const inputsReady = yield* readProducerStoredInputsReadyFx({
			inputs: checked.productInputs,
			producerItemInstanceId: action.producerItemInstanceId,
			productId: checked.productId,
			save: nextSave,
		});
		if (!inputsReady) {
			if (consumed.events.length > 0) nextSave.updatedAtMs = nowMs;
			return {
				events: consumed.events,
				nextWakeAtMs: yield* readNextWakeAtMsFx({
					save: nextSave,
				}),
				save: nextSave,
			} satisfies GameEngineResult;
		}
		yield* consumeProducerStoredInputsFx({
			inputs: checked.productInputs,
			nextSave,
			producerItemInstanceId: action.producerItemInstanceId,
			productId: checked.productId,
		});
	}
	const jobId = yield* createGameJobIdFx();
	const queuedStartAtMs = Math.max(
		nowMs,
		...Object.values(nextSave.producerJobs)
			.filter((job) => job.producerItemInstanceId === action.producerItemInstanceId)
			.map((job) => job.completesAtMs),
	);
	const durationMs = readProducerProductDurationMs({
		product: checked.product,
		producerItemInstanceId: action.producerItemInstanceId,
		requirements: checked.requirements,
		save,
	});
	const completesAtMs = queuedStartAtMs + durationMs;
	nextSave.producerJobs[jobId] = {
		completesAtMs,
		id: jobId,
		outputTableId: checked.product.outputTableId ?? null,
		placement: checked.product.placement,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: checked.productId,
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
				productId: checked.productId,
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
