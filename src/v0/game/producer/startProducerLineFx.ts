import { Effect } from "effect";
import { autoFillProducerLineInputsFx } from "~/v0/game/producer/autoFillProducerLineInputsFx";
import { checkProducerLineStartReadinessFx } from "~/v0/game/producer/checkProducerLineStartReadinessFx";
import { checkProducerLineStartRuntimeConstraintsFx } from "~/v0/game/producer/checkProducerLineStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/activation/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameActiveEffectIdFx } from "~/v0/game/effects/createGameActiveEffectIdFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerLineStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerLineStoredInputQuantitiesFx";
import { readProducerJobTimingFx } from "~/v0/game/producer/readProducerJobTimingFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerLineStart } from "~/v0/game/action/GameActionProducerLineStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { readActivationInputStoredQuantityReady } from "~/v0/game/activation/readActivationInputStoredQuantityReady";

export namespace startProducerLineFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerLineStart;
		nowMs: number;
	}
}

const readProducerStoredInputsReadyFx = Effect.fn("readProducerStoredInputsReadyFx")(function* ({
	inputs,
	save,
	producerItemInstanceId,
	lineId,
}: {
	inputs: readonly GameActivationInput[];
	save: GameSave;
	producerItemInstanceId: string;
	lineId: string;
}) {
	const storedInputs = yield* readProducerLineStoredInputQuantitiesFx({
		producerItemInstanceId,
		lineId,
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

export const startProducerLineFx = Effect.fn("startProducerLineFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: startProducerLineFx.Props) {
	const checked = yield* checkProducerLineStartReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const consumed = action.inputRefs.length
		? yield* consumeActivationInputsFx({
				inputRefs: action.inputRefs,
				inputs: checked.lineInputs,
				nowMs,
				reason: "producer-line-input",
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
		yield* autoFillProducerLineInputsFx({
			events: consumed.events,
			inputs: checked.lineInputs,
			nextSave,
			nowMs,
			producerItemInstanceId: action.producerItemInstanceId,
			lineId: checked.lineId,
		});
		const inputsReady = yield* readProducerStoredInputsReadyFx({
			inputs: checked.lineInputs,
			producerItemInstanceId: action.producerItemInstanceId,
			lineId: checked.lineId,
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
			inputs: checked.lineInputs,
			nextSave,
			producerItemInstanceId: action.producerItemInstanceId,
			lineId: checked.lineId,
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
	yield* checkProducerLineStartRuntimeConstraintsFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		line: checked.line,
		lineId: checked.lineId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const jobId = yield* createGameJobIdFx();
	const jobTiming = yield* readProducerJobTimingFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		lineId: checked.lineId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const readyAtMs = jobTiming.readyAtMs;

	const activatedEffect = checked.line.activatesEffectId
		? {
				effectId: checked.line.activatesEffectId,
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
		lineId: checked.lineId,
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
				lineId: checked.lineId,
				startAtMs: queuedStartAtMs,
				type: "producer_line.started" as const,
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
