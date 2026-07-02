import { Effect } from "effect";
import { autoFillLineInputsFx } from "~/v0/game/producer/autoFillLineInputsFx";
import { checkLineStartReadinessFx } from "~/v0/game/producer/checkLineStartReadinessFx";
import { checkLineStartRuntimeConstraintsFx } from "~/v0/game/producer/checkLineStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/activation/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/v0/game/producer/consumeProducerStoredInputsFx";
import { createGameActiveEffectIdFx } from "~/v0/game/effects/createGameActiveEffectIdFx";
import { createGameJobIdFx } from "~/v0/game/job/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readLineStoredInputQuantitiesFx } from "~/v0/game/producer/readLineStoredInputQuantitiesFx";
import { readProducerJobTimingFx } from "~/v0/game/producer/readProducerJobTimingFx";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionLineStart } from "~/v0/game/action/GameActionLineStart";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";
import { readActivationInputStoredQuantityReady } from "~/v0/game/activation/readActivationInputStoredQuantityReady";

export namespace startLineFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionLineStart;
		nowMs: number;
	}
}

const readProducerStoredInputsReadyFx = Effect.fn("readProducerStoredInputsReadyFx")(function* ({
	inputs,
	save,
	itemInstanceId,
	lineId,
}: {
	inputs: readonly GameActivationInput[];
	save: GameSave;
	itemInstanceId: string;
	lineId: string;
}) {
	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId,
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

export const startLineFx = Effect.fn("startLineFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: startLineFx.Props) {
	const checked = yield* checkLineStartReadinessFx({
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
				reason: "line-input",
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
		yield* autoFillLineInputsFx({
			events: consumed.events,
			inputs: checked.lineInputs,
			nextSave,
			nowMs,
			itemInstanceId: action.itemInstanceId,
			lineId: checked.lineId,
		});
		const inputsReady = yield* readProducerStoredInputsReadyFx({
			inputs: checked.lineInputs,
			itemInstanceId: action.itemInstanceId,
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
			itemInstanceId: action.itemInstanceId,
			lineId: checked.lineId,
		});
	}
	const queuedStartAtMs = Math.max(
		nowMs,
		...readWorldProducerJobFacts({
			nowMs,
			save: nextSave,
		})
			.filter((facts) => facts.itemInstanceId === action.itemInstanceId)
			.map((facts) => facts.releaseAtMs)
			.filter((wakeAtMs): wakeAtMs is number => wakeAtMs !== undefined),
	);
	yield* checkLineStartRuntimeConstraintsFx({
		config,
		itemInstanceId: action.itemInstanceId,
		line: checked.line,
		lineId: checked.lineId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const jobId = yield* createGameJobIdFx();
	const jobTiming = yield* readProducerJobTimingFx({
		config,
		itemInstanceId: action.itemInstanceId,
		lineId: checked.lineId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const readyAtMs = jobTiming.readyAtMs;

	const activatedEffect = checked.line.effect
		? {
				effectId: checked.line.effect.id,
				endAtMs: readyAtMs,
				id: yield* createGameActiveEffectIdFx(),
				producerJobId: jobId,
				sourceItemInstanceId: action.itemInstanceId,
				startAtMs: queuedStartAtMs,
			}
		: undefined;
	if (activatedEffect) {
		nextSave.activeEffects[activatedEffect.id] = activatedEffect;
	}

	nextSave.producerJobs[jobId] = {
		readyAtMs,
		id: jobId,
		itemInstanceId: action.itemInstanceId,
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
				itemInstanceId: action.itemInstanceId,
				lineId: checked.lineId,
				startAtMs: queuedStartAtMs,
				type: "line.started" as const,
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
