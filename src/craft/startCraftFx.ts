import { Effect } from "effect";
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

const readCraftStartReadinessFx = Effect.fn("startCraftFx.readCraftStartReadinessFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: startCraftFx.Props) {
	return yield* checkCraftStartReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createCraftStartWorkingStateFx = Effect.fn("startCraftFx.createCraftStartWorkingStateFx")(
	function* ({ checked, save }: { checked: CraftStartReadiness; save: GameSave }) {
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
)(function* ({ props, state }: { props: startCraftFx.Props; state: CraftStartWorkingState }) {
	const autoFillInputsReady = yield* autoFillCraftInputsFx({
		events: state.events,
		inputs: state.checked.recipe.inputs,
		nextSave: state.nextSave,
		nowMs: props.nowMs,
		recipeId: props.action.recipeId,
		targetItemInstanceId: props.action.targetItemInstanceId,
	});
	return (
		autoFillInputsReady ||
		(yield* readCraftStoredInputsReadyFx({
			inputs: state.checked.recipe.inputs,
			save: state.nextSave,
			targetItemInstanceId: props.action.targetItemInstanceId,
		}))
	);
});

const finishCraftStartWithoutRunningJobFx = Effect.fn(
	"startCraftFx.finishCraftStartWithoutRunningJobFx",
)(function* ({ props, state }: { props: startCraftFx.Props; state: CraftStartWorkingState }) {
	if (state.events.length > 0) state.nextSave.updatedAtMs = props.nowMs;
	return yield* createGameEngineResultFx({
		config: props.config,
		events: state.events,
		nowMs: props.nowMs,
		save: state.nextSave,
	});
});

const assertCraftStartRuntimeConstraintsFx = Effect.fn(
	"startCraftFx.assertCraftStartRuntimeConstraintsFx",
)(function* ({ props, state }: { props: startCraftFx.Props; state: CraftStartWorkingState }) {
	yield* checkCraftStartRuntimeConstraintsFx({
		config: props.config,
		nowMs: props.nowMs,
		recipe: state.checked.recipe,
		save: state.nextSave,
		targetItem: state.checked.targetItem,
		targetItemInstanceId: props.action.targetItemInstanceId,
	});
});

const insertCraftJobFx = Effect.fn("startCraftFx.insertCraftJobFx")(function* ({
	props,
	state,
}: {
	props: startCraftFx.Props;
	state: CraftStartWorkingState;
}) {
	const jobId = yield* createGameJobIdFx();
	const timing = yield* readCraftJobEffectiveTimingFx({
		recipe: state.checked.recipe,
		save: state.nextSave,
		startAtMs: props.nowMs,
		targetItemInstanceId: props.action.targetItemInstanceId,
	});
	state.nextSave.craftJobs[jobId] = {
		id: jobId,
		readyAtMs: timing.readyAtMs,
		recipeId: props.action.recipeId,
		startAtMs: timing.startAtMs,
		targetItemInstanceId: props.action.targetItemInstanceId,
	};
	return {
		jobId,
		timing,
	};
});

const finishCraftStartWithRunningJobFx = Effect.fn("startCraftFx.finishCraftStartWithRunningJobFx")(
	function* ({ props, state }: { props: startCraftFx.Props; state: CraftStartWorkingState }) {
		yield* assertCraftStartRuntimeConstraintsFx({
			props,
			state,
		});
		delete state.nextSave.craftInputs[props.action.targetItemInstanceId];
		const { jobId, timing } = yield* insertCraftJobFx({
			props,
			state,
		});
		state.nextSave.updatedAtMs = props.nowMs;

		return yield* createGameEngineResultFx({
			config: props.config,
			events: [
				...state.events,
				{
					atMs: props.nowMs,
					jobId,
					readyAtMs: timing.readyAtMs,
					recipeId: props.action.recipeId,
					startAtMs: timing.startAtMs,
					targetItemInstanceId: props.action.targetItemInstanceId,
					type: "craft.started" as const,
				},
			],
			nowMs: props.nowMs,
			save: state.nextSave,
		});
	},
);

const startCraftProgramFx = Effect.fn("startCraftFx.startCraftProgramFx")(function* (
	props: startCraftFx.Props,
) {
	const state = yield* createCraftStartWorkingStateFx({
		checked: yield* readCraftStartReadinessFx(props),
		save: props.save,
	});
	const inputsReady = yield* readCraftInputsReadyAfterAutoFillFx({
		props,
		state,
	});
	return inputsReady
		? yield* finishCraftStartWithRunningJobFx({
				props,
				state,
			})
		: yield* finishCraftStartWithoutRunningJobFx({
				props,
				state,
			});
});

export const startCraftFx = Effect.fn("startCraftFx")(function* (props: startCraftFx.Props) {
	return yield* startCraftProgramFx(props);
});
