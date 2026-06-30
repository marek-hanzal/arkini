import { Effect } from "effect";
import { autoFillProducerProductInputsFx } from "~/v0/game/producer/autoFillProducerProductInputsFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/producer/checkProducerProductStartReadinessFx";
import { checkProducerProductStartRuntimeConstraintsFx } from "~/v0/game/producer/checkProducerProductStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/activation/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameActiveEffectIdFx } from "~/v0/game/effects/createGameActiveEffectIdFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { readProducerJobTimingFx } from "~/v0/game/producer/readProducerJobTimingFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/action/GameActionProducerProductStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { readActivationInputStoredQuantityReady } from "~/v0/game/activation/readActivationInputStoredQuantityReady";

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
	return inputs.every((input) =>
		readActivationInputStoredQuantityReady({
			input,
			storedQuantity: readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}),
		}),
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
					config,
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
		...readWorldProducerJobFacts({
			nowMs,
			save: nextSave,
		})
			.filter((facts) => facts.producerItemInstanceId === action.producerItemInstanceId)
			.map((facts) => facts.releaseAtMs)
			.filter((wakeAtMs): wakeAtMs is number => wakeAtMs !== undefined),
	);
	yield* checkProducerProductStartRuntimeConstraintsFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		product: checked.product,
		productId: checked.productId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const jobId = yield* createGameJobIdFx();
	const jobTiming = yield* readProducerJobTimingFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: checked.productId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const readyAtMs = jobTiming.readyAtMs;

	const activatedEffect = checked.product.activatesEffectId
		? {
				effectId: checked.product.activatesEffectId,
				endAtMs: readyAtMs,
				id: yield* createGameActiveEffectIdFx(),
				producerJobId: jobId,
				sourceItemInstanceId: action.producerItemInstanceId,
				startAtMs: queuedStartAtMs,
			}
		: undefined;
	if (activatedEffect) {
		nextSave.activeEffects[activatedEffect.id] = activatedEffect;
	}

	nextSave.producerJobs[jobId] = {
		readyAtMs,
		id: jobId,
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
							producerJobId: activatedEffect.producerJobId,
							sourceItemInstanceId: activatedEffect.sourceItemInstanceId,
							type: "effect.activated" as const,
						},
					]
				: []),
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
