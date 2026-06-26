import { Effect } from "effect";
import { autoFillProducerProductInputsFx } from "~/v0/game/producer/autoFillProducerProductInputsFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/producer/checkProducerProductStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { readProducerJobWakeAtMs } from "~/v0/game/producer/producerDeliveryTiming";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/action/GameActionProducerProductStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

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
	return inputs.every(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) >= input.quantity,
	);
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
		nowMs,
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
					nowMs,
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
	const queuedStartAtMs = Math.max(
		nowMs,
		...Object.values(nextSave.producerJobs)
			.filter((job) => job.producerItemInstanceId === action.producerItemInstanceId)
			.map(readProducerJobWakeAtMs),
	);
	const durationMs = checked.effectiveProductLine.durationMs;
	const readyAtMs = queuedStartAtMs + durationMs;

	const activatedEffect = checked.product.activatesEffectId
		? {
				startAtMs: queuedStartAtMs,
				effectId: checked.product.activatesEffectId,
				endAtMs: readyAtMs,
				id: yield* createGameJobIdFx(),
				sourceItemInstanceId: action.producerItemInstanceId,
			}
		: undefined;
	if (activatedEffect) {
		nextSave.activeEffects[activatedEffect.id] = activatedEffect;
	}

	const jobId = yield* createGameJobIdFx();
	nextSave.producerJobs[jobId] = {
		readyAtMs,
		id: jobId,
		outputTableId: checked.product.outputTableId ?? null,
		placement: checked.product.placement,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: checked.productId,
		startAtMs: queuedStartAtMs,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				atMs: nowMs,
				readyAtMs,
				jobId,
				producerItemInstanceId: action.producerItemInstanceId,
				productId: checked.productId,
				startAtMs: queuedStartAtMs,
				type: "product.started" as const,
			},
			...(activatedEffect
				? [
						{
							atMs: nowMs,
							startAtMs: activatedEffect.startAtMs,
							effectId: activatedEffect.effectId,
							endAtMs: activatedEffect.endAtMs,
							id: activatedEffect.id,
							sourceItemInstanceId: activatedEffect.sourceItemInstanceId,
							type: "effect.activated" as const,
						},
					]
				: []),
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
