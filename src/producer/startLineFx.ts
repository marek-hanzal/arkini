import { Effect } from "effect";
import { autoFillLineInputsFx } from "~/producer/autoFillLineInputsFx";
import { checkLineStartReadinessFx } from "~/producer/checkLineStartReadinessFx";
import { checkLineStartRuntimeConstraintsFx } from "~/producer/checkLineStartRuntimeConstraintsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { consumeProducerStoredInputsFx } from "~/producer/consumeProducerStoredInputsFx";
import { createGameActiveEffectIdFx } from "~/effects/createGameActiveEffectIdFx";
import { writeActiveEffectToSaveFx } from "~/effects/writeActiveEffectToSaveFx";
import { writeProducerJobToSaveFx } from "~/producer/writeProducerJobToSaveFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";
import { readProducerJobTimingFx } from "~/producer/readProducerJobTimingFx";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import { spendLineCapacityEffectsFx } from "~/capacity/spendLineCapacityEffectsFx";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";
import { readActivationInputStoredQuantityReady } from "~/activation/readActivationInputStoredQuantityReady";

export namespace startLineFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionLineStartSchema.Type;
		nowMs: number;
	}
}

type LineStartReadiness = Effect.Effect.Success<ReturnType<typeof checkLineStartReadinessFx>>;

type LineStartConsumedInputRefs = {
	events: GameEvent[];
	save: GameSave;
};

type LineStartPreparedInputs = {
	events: GameEvent[];
	nextSave: GameSave;
	ready: boolean;
};

type LineStartedState = {
	events: GameEvent[];
	nextSave: GameSave;
};

type ActivatedLineEffect = {
	effectId: string;
	endAtMs: number;
	id: string;
	producerJobId: string;
	sourceItemInstanceId: string;
	startAtMs: number;
};

type LineStartExecutionScope = startLineFx.Props & {
	checked: LineStartReadiness;
};

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

const prepareLineStartInputsFx = Effect.fn("startLineFx.prepareLineStartInputsFx")(function* (
	scope: LineStartExecutionScope,
) {
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
});

const readQueuedLineStartAtMsFx = Effect.fn("startLineFx.readQueuedLineStartAtMsFx")(function* (
	scope: LineStartExecutionScope,
	{
		nextSave,
	}: {
		nextSave: GameSave;
	},
) {
	const { action, nowMs } = scope;
	return Math.max(
		nowMs,
		...readWorldProducerJobFacts({
			nowMs,
			save: nextSave,
		})
			.filter((facts) => facts.itemInstanceId === action.itemInstanceId)
			.map((facts) => facts.releaseAtMs)
			.filter((wakeAtMs): wakeAtMs is number => wakeAtMs !== undefined),
	);
});

const createActivatedLineEffectFx = Effect.fn("startLineFx.createActivatedLineEffectFx")(function* (
	scope: LineStartExecutionScope,
	{
		jobId,
		queuedStartAtMs,
		readyAtMs,
	}: {
		jobId: string;
		queuedStartAtMs: number;
		readyAtMs: number;
	},
) {
	const { action, checked } = scope;
	if (!checked.line.effect) return undefined;

	return {
		effectId: checked.line.effect.id,
		endAtMs: readyAtMs,
		id: yield* createGameActiveEffectIdFx(),
		producerJobId: jobId,
		sourceItemInstanceId: action.itemInstanceId,
		startAtMs: queuedStartAtMs,
	} satisfies ActivatedLineEffect;
});

const readLineStartedEventsFx = Effect.fn("startLineFx.readLineStartedEventsFx")(function* (
	scope: LineStartExecutionScope,
	{
		activatedEffect,
		capacityEvents,
		jobId,
		queuedStartAtMs,
		readyAtMs,
	}: {
		activatedEffect: ActivatedLineEffect | undefined;
		capacityEvents: readonly GameEvent[];
		jobId: string;
		queuedStartAtMs: number;
		readyAtMs: number;
	},
) {
	const { action, checked, nowMs } = scope;
	return [
		...capacityEvents,
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
	] satisfies GameEvent[];
});

const startQueuedLineJobFx = Effect.fn("startLineFx.startQueuedLineJobFx")(function* (
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

export const startLineFx = Effect.fn("startLineFx")(function* (props: startLineFx.Props) {
	const checked = yield* checkLineStartReadinessFx(props);
	const scope = {
		...props,
		checked,
	} satisfies LineStartExecutionScope;

	const preparedInputs = yield* prepareLineStartInputsFx(scope);
	if (!preparedInputs.ready) {
		return yield* createGameEngineResultFx({
			config: props.config,
			events: preparedInputs.events,
			nowMs: props.nowMs,
			save: preparedInputs.nextSave,
		});
	}

	const started = yield* startQueuedLineJobFx(scope, {
		nextSave: preparedInputs.nextSave,
	});
	return yield* createGameEngineResultFx({
		config: props.config,
		events: [
			...preparedInputs.events,
			...started.events,
		],
		nowMs: props.nowMs,
		save: started.nextSave,
	});
});
