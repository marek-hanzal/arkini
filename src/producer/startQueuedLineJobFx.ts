import { Effect } from "effect";
import { checkLineStartRuntimeConstraintsFx } from "~/producer/checkLineStartRuntimeConstraintsFx";
import { createActivatedLineEffectFx } from "~/producer/createActivatedLineEffectFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readLineStartedEventsFx } from "~/producer/readLineStartedEventsFx";
import type { LineStartedState, LineStartExecutionScope } from "~/producer/LineStartExecutionTypes";
import { readProducerJobTimingFx } from "~/producer/readProducerJobTimingFx";
import { readQueuedLineStartAtMsFx } from "~/producer/readQueuedLineStartAtMsFx";
import { spendLineCapacityEffectsFx } from "~/capacity/spendLineCapacityEffectsFx";
import { writeActiveEffectToSaveFx } from "~/effects/writeActiveEffectToSaveFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";

export const startQueuedLineJobFx = Effect.fn("startLineFx.startQueuedLineJobFx")(function* (
	scope: LineStartExecutionScope,
	{
		nextSave,
	}: {
		nextSave: GameSave;
	},
) {
	const { action, checked, config, nowMs } = scope;
	const queuedStartAtMs = yield* readQueuedLineStartAtMsFx(scope, {
		nextSave,
	});
	yield* checkLineStartRuntimeConstraintsFx({
		config,
		itemInstanceId: action.itemInstanceId,
		line: checked.line,
		lineId: checked.lineId,
		save: nextSave,
		startAtMs: queuedStartAtMs,
	});
	const capacityEvents = yield* spendLineCapacityEffectsFx({
		config,
		itemInstanceId: action.itemInstanceId,
		line: checked.line,
		nextSave,
		nowMs,
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
	const activatedEffect = yield* createActivatedLineEffectFx(scope, {
		jobId,
		queuedStartAtMs,
		readyAtMs,
	});
	if (activatedEffect) {
		yield* writeActiveEffectToSaveFx({
			activeEffect: activatedEffect,
			save: nextSave,
		});
	}

	yield* writeProducerJobToSaveFx({
		job: {
			readyAtMs,
			id: jobId,
			itemInstanceId: action.itemInstanceId,
			lineId: checked.lineId,
			startAtMs: queuedStartAtMs,
		},
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: yield* readLineStartedEventsFx(scope, {
			activatedEffect,
			capacityEvents,
			jobId,
			queuedStartAtMs,
			readyAtMs,
		}),
		nextSave,
	} satisfies LineStartedState;
});
