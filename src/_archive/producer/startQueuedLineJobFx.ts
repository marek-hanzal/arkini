import { Effect } from "effect";
import { checkLineStartRuntimeConstraintsFx } from "~/producer/checkLineStartRuntimeConstraintsFx";
import { createActivatedLineEffectFx } from "~/producer/createActivatedLineEffectFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readLineStartedEventsFx } from "~/producer/readLineStartedEventsFx";
import type { LineStartReadiness, LineStartedState } from "~/producer/LineStartExecutionTypes";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readProducerJobTimingFx } from "~/producer/readProducerJobTimingFx";
import { readQueuedLineStartAtMsFx } from "~/producer/readQueuedLineStartAtMsFx";
import { spendLineCapacityEffectsFx } from "~/capacity/spendLineCapacityEffectsFx";
import { writeActiveEffectToSaveFx } from "~/effects/writeActiveEffectToSaveFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";

export const startQueuedLineJobFx = Effect.fn("startLineFx.startQueuedLineJobFx")(function* ({
	action,
	checked,
	config,
	nextSave,
	nowMs,
}: {
	action: {
		itemInstanceId: string;
	};
	checked: LineStartReadiness;
	config: GameConfig;
	nextSave: GameSave;
	nowMs: number;
}) {
	const queuedStartAtMs = yield* readQueuedLineStartAtMsFx({
		itemInstanceId: action.itemInstanceId,
		nextSave,
		nowMs,
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
	const activatedEffect = yield* createActivatedLineEffectFx({
		itemInstanceId: action.itemInstanceId,
		jobId,
		lineEffectId: checked.line.effect?.id,
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
		events: yield* readLineStartedEventsFx({
			activatedEffect,
			capacityEvents,
			itemInstanceId: action.itemInstanceId,
			jobId,
			lineId: checked.lineId,
			nowMs,
			queuedStartAtMs,
			readyAtMs,
		}),
		nextSave,
	} satisfies LineStartedState;
});
