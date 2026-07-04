import { Context, Effect } from "effect";
import type { GameActionCraftStartSchema } from "~/action/GameActionCraftStartSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { autoFillCraftInputsFx } from "~/craft/autoFillCraftInputsFx";
import { checkCraftStartReadinessFx } from "~/craft/checkCraftStartReadinessFx";
import { checkCraftStartRuntimeConstraintsFx } from "~/craft/checkCraftStartRuntimeConstraintsFx";
import { readCraftJobEffectiveTimingFx } from "~/craft/readCraftJobEffectiveTimingFx";
import { readCraftStoredInputsReadyFx } from "~/craft/readCraftStoredInputsReadyFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { createGameJobIdFx } from "~/job/createGameJobIdFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace startCraftFx {
	export interface Props {
		action: GameActionCraftStartSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type CraftStartReadiness = Effect.Effect.Success<ReturnType<typeof checkCraftStartReadinessFx>>;

type CraftStartWorkingState = {
	checked: CraftStartReadiness;
	events: GameEvent[];
	nextSave: GameSave;
};

class CraftStartExecutionScopeFx extends Context.Tag("CraftStartExecutionScopeFx")<
	CraftStartExecutionScopeFx,
	startCraftFx.Props
>() {
	//
}

const readCraftStartReadinessFx = Effect.fn("startCraftFx.readCraftStartReadinessFx")(function* () {
	const { action, config, nowMs, save } = yield* CraftStartExecutionScopeFx;
	return yield* checkCraftStartReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createCraftStartWorkingStateFx = Effect.fn("startCraftFx.createCraftStartWorkingStateFx")(
	function* ({ checked }: { checked: CraftStartReadiness }) {
		const { save } = yield* CraftStartExecutionScopeFx;
		return {
			checked,
			events: [],
			nextSave: yield* cloneGameSaveFx({
				save,
			}),
		} satisfies CraftStartWorkingState;
	},
);

const readCraftInputsReadyAfterAutoFillFx = Effect.fn(
	"startCraftFx.readCraftInputsReadyAfterAutoFillFx",
)(function* ({ checked, events, nextSave }: CraftStartWorkingState) {
	const { action, nowMs } = yield* CraftStartExecutionScopeFx;
	const autoFillInputsReady = yield* autoFillCraftInputsFx({
		events,
		inputs: checked.recipe.inputs,
		nextSave,
		nowMs,
		recipeId: action.recipeId,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	return (
		autoFillInputsReady ||
		(yield* readCraftStoredInputsReadyFx({
			inputs: checked.recipe.inputs,
			save: nextSave,
			targetItemInstanceId: action.targetItemInstanceId,
		}))
	);
});

const finishCraftStartWithoutRunningJobFx = Effect.fn(
	"startCraftFx.finishCraftStartWithoutRunningJobFx",
)(function* ({ events, nextSave }: CraftStartWorkingState) {
	const { config, nowMs } = yield* CraftStartExecutionScopeFx;
	if (events.length > 0) nextSave.updatedAtMs = nowMs;
	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: nextSave,
	});
});

const assertCraftStartRuntimeConstraintsFx = Effect.fn(
	"startCraftFx.assertCraftStartRuntimeConstraintsFx",
)(function* ({ checked, nextSave }: CraftStartWorkingState) {
	const { action, config, nowMs } = yield* CraftStartExecutionScopeFx;
	yield* checkCraftStartRuntimeConstraintsFx({
		config,
		nowMs,
		recipe: checked.recipe,
		save: nextSave,
		targetItem: checked.targetItem,
		targetItemInstanceId: action.targetItemInstanceId,
	});
});

const insertCraftJobFx = Effect.fn("startCraftFx.insertCraftJobFx")(function* ({
	checked,
	nextSave,
}: CraftStartWorkingState) {
	const { action, nowMs } = yield* CraftStartExecutionScopeFx;
	const jobId = yield* createGameJobIdFx();
	const timing = yield* readCraftJobEffectiveTimingFx({
		recipe: checked.recipe,
		save: nextSave,
		startAtMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	nextSave.craftJobs[jobId] = {
		id: jobId,
		readyAtMs: timing.readyAtMs,
		recipeId: action.recipeId,
		startAtMs: timing.startAtMs,
		targetItemInstanceId: action.targetItemInstanceId,
	};
	return {
		jobId,
		timing,
	};
});

const finishCraftStartWithRunningJobFx = Effect.fn("startCraftFx.finishCraftStartWithRunningJobFx")(
	function* (state: CraftStartWorkingState) {
		const { action, config, nowMs } = yield* CraftStartExecutionScopeFx;
		yield* assertCraftStartRuntimeConstraintsFx(state);
		delete state.nextSave.craftInputs[action.targetItemInstanceId];
		const { jobId, timing } = yield* insertCraftJobFx(state);
		state.nextSave.updatedAtMs = nowMs;

		return yield* createGameEngineResultFx({
			config,
			events: [
				...state.events,
				{
					atMs: nowMs,
					jobId,
					readyAtMs: timing.readyAtMs,
					recipeId: action.recipeId,
					startAtMs: timing.startAtMs,
					targetItemInstanceId: action.targetItemInstanceId,
					type: "craft.started" as const,
				},
			],
			nowMs,
			save: state.nextSave,
		});
	},
);

const startCraftProgramFx = Effect.fn("startCraftFx.startCraftProgramFx")(function* () {
	const state = yield* createCraftStartWorkingStateFx({
		checked: yield* readCraftStartReadinessFx(),
	});
	const inputsReady = yield* readCraftInputsReadyAfterAutoFillFx(state);
	return inputsReady
		? yield* finishCraftStartWithRunningJobFx(state)
		: yield* finishCraftStartWithoutRunningJobFx(state);
});

export const startCraftFx = Effect.fn("startCraftFx")(function* (props: startCraftFx.Props) {
	return yield* startCraftProgramFx().pipe(
		Effect.provideService(CraftStartExecutionScopeFx, props),
	);
});
