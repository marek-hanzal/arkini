import { Effect } from "effect";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { autoFillLineInputsFx } from "~/producer/autoFillLineInputsFx";
import { consumeProducerStoredInputsFx } from "~/producer/consumeProducerStoredInputsFx";
import type {
	LineStartConsumedInputRefs,
	LineStartExecutionScope,
	LineStartPreparedInputs,
} from "~/producer/LineStartExecutionTypes";
import { readProducerStoredInputsReadyFx } from "~/producer/readProducerStoredInputsReadyFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const consumeExplicitLineStartInputRefsFx = Effect.fn(
	"startLineFx.consumeExplicitLineStartInputRefsFx",
)(function* ({ action, checked, nowMs, save }: LineStartExecutionScope) {
	if (action.inputRefs.length === 0) {
		return {
			events: [],
			save,
		} satisfies LineStartConsumedInputRefs;
	}

	return yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: checked.lineInputs,
		nowMs,
		reason: "line-input",
		save,
	});
});

const autoFillAndConsumeStoredLineInputsFx = Effect.fn(
	"startLineFx.autoFillAndConsumeStoredLineInputsFx",
)(function* (
	scope: LineStartExecutionScope,
	{
		events,
		nextSave,
	}: {
		events: GameEvent[];
		nextSave: GameSave;
	},
) {
	const { action, checked, nowMs } = scope;
	if (action.inputRefs.length > 0) return true;

	yield* autoFillLineInputsFx({
		events,
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
	if (!inputsReady) return false;

	yield* consumeProducerStoredInputsFx({
		inputs: checked.lineInputs,
		nextSave,
		itemInstanceId: action.itemInstanceId,
		lineId: checked.lineId,
	});
	return true;
});

export const prepareLineStartInputsFx = Effect.fn("startLineFx.prepareLineStartInputsFx")(
	function* (scope: LineStartExecutionScope) {
		const { nowMs } = scope;
		const consumed = yield* consumeExplicitLineStartInputRefsFx(scope);
		const nextSave = yield* cloneGameSaveFx({
			save: consumed.save,
		});
		const ready = yield* autoFillAndConsumeStoredLineInputsFx(scope, {
			events: consumed.events,
			nextSave,
		});
		if (!ready && consumed.events.length > 0) nextSave.updatedAtMs = nowMs;

		return {
			events: consumed.events,
			nextSave,
			ready,
		} satisfies LineStartPreparedInputs;
	},
);
