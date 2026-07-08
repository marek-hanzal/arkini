import { Effect } from "effect";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { autoFillLineInputsFx } from "~/producer/autoFillLineInputsFx";
import { consumeProducerStoredInputsFx } from "~/producer/consumeProducerStoredInputsFx";
import type {
	LineStartConsumedInputRefs,
	LineStartExecutionProps,
	LineStartPreparedInputs,
	LineStartReadiness,
} from "~/producer/LineStartExecutionTypes";
import { readProducerStoredInputsReadyFx } from "~/producer/readProducerStoredInputsReadyFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const consumeExplicitLineStartInputRefsFx = Effect.fn(
	"startLineFx.consumeExplicitLineStartInputRefsFx",
)(function* ({
	inputRefs,
	lineInputs,
	nowMs,
	save,
}: {
	inputRefs: LineStartExecutionProps["action"]["inputRefs"];
	lineInputs: LineStartReadiness["lineInputs"];
	nowMs: number;
	save: GameSave;
}) {
	if (inputRefs.length === 0) {
		return {
			events: [],
			save,
		} satisfies LineStartConsumedInputRefs;
	}

	return yield* consumeActivationInputsFx({
		inputRefs,
		inputs: lineInputs,
		nowMs,
		reason: "line-input",
		save,
	});
});

const autoFillAndConsumeStoredLineInputsFx = Effect.fn(
	"startLineFx.autoFillAndConsumeStoredLineInputsFx",
)(function* ({
		events,
		inputRefs,
		itemInstanceId,
		lineId,
		lineInputs,
		nextSave,
		nowMs,
	}: {
		events: GameEvent[];
		inputRefs: LineStartExecutionProps["action"]["inputRefs"];
		itemInstanceId: string;
		lineId: string;
		lineInputs: LineStartReadiness["lineInputs"];
		nextSave: GameSave;
		nowMs: number;
	}) {
		if (inputRefs.length > 0) return true;

		yield* autoFillLineInputsFx({
			events,
			inputs: lineInputs,
			nextSave,
			nowMs,
			itemInstanceId,
			lineId,
		});
		const inputsReady = yield* readProducerStoredInputsReadyFx({
			inputs: lineInputs,
			itemInstanceId,
			lineId,
			save: nextSave,
		});
		if (!inputsReady) return false;

		yield* consumeProducerStoredInputsFx({
			inputs: lineInputs,
			nextSave,
			itemInstanceId,
			lineId,
		});
		return true;
	});

export const prepareLineStartInputsFx = Effect.fn("startLineFx.prepareLineStartInputsFx")(
	function* ({
		action,
		checked,
		nowMs,
		save,
	}: {
		action: {
			inputRefs: LineStartExecutionProps["action"]["inputRefs"];
			itemInstanceId: string;
		};
		checked: LineStartReadiness;
		nowMs: number;
		save: GameSave;
	}) {
		const consumed = yield* consumeExplicitLineStartInputRefsFx({
			inputRefs: action.inputRefs,
			lineInputs: checked.lineInputs,
			nowMs,
			save,
		});
		const nextSave = yield* cloneGameSaveFx({
			save: consumed.save,
		});
		const ready = yield* autoFillAndConsumeStoredLineInputsFx({
			events: consumed.events,
			inputRefs: action.inputRefs,
			itemInstanceId: action.itemInstanceId,
			lineId: checked.lineId,
			lineInputs: checked.lineInputs,
			nextSave,
			nowMs,
		});
		if (!ready && consumed.events.length > 0) nextSave.updatedAtMs = nowMs;

		return {
			events: consumed.events,
			nextSave,
			ready,
		} satisfies LineStartPreparedInputs;
	},
);
