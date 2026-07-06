import { Effect } from "effect";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import type { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkCraftInputStoreReadinessFx } from "~/craft/checkCraftInputStoreReadinessFx";
import { readCraftStoredInputsReadyFx } from "~/craft/readCraftStoredInputsReadyFx";
import { startCraftFx } from "~/craft/startCraftFx";
import { storeCraftResolvedInputFx } from "~/craft/storeCraftResolvedInputFx";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace storeCraftInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputStoreSchema.Type;
		nowMs: number;
	}
}

type CraftInputStoreReadiness = Effect.Effect.Success<
	ReturnType<typeof checkCraftInputStoreReadinessFx>
>;

type CraftInputStoreWorkingState = {
	checked: CraftInputStoreReadiness;
	events: GameEvent[];
	nextSave: GameSave;
};

const readCraftInputStoreReadinessFx = Effect.fn(
	"storeCraftInputFx.readCraftInputStoreReadinessFx",
)(function* ({ action, config, nowMs, save }: storeCraftInputFx.Props) {
	return yield* checkCraftInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createStoredCraftInputWorkingStateFx = Effect.fn(
	"storeCraftInputFx.createStoredCraftInputWorkingStateFx",
)(function* ({
	checked,
	props,
}: {
	checked: CraftInputStoreReadiness;
	props: storeCraftInputFx.Props;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});
	const events: GameEvent[] = [];

	if (checked.inputSlot.consume) {
		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason: "craft-input-store",
			ref: checked.resolvedRef,
		});
	}
	yield* storeCraftResolvedInputFx({
		events,
		nextSave,
		nowMs: props.nowMs,
		recipeId: checked.target.recipeId,
		targetItemInstanceId: props.action.targetItemInstanceId,
		ref: checked.resolvedRef,
	});
	nextSave.updatedAtMs = props.nowMs;

	return {
		checked,
		events,
		nextSave,
	} satisfies CraftInputStoreWorkingState;
});

const buildStoredCraftInputResultFx = Effect.fn("storeCraftInputFx.buildStoredCraftInputResultFx")(
	function* ({
		events,
		nextSave,
		props,
	}: Pick<CraftInputStoreWorkingState, "events" | "nextSave"> & {
		props: storeCraftInputFx.Props;
	}) {
		return yield* createGameEngineResultFx({
			config: props.config,
			events,
			nowMs: props.nowMs,
			save: nextSave,
		});
	},
);

const readStoredCraftInputReadyFx = Effect.fn("storeCraftInputFx.readStoredCraftInputReadyFx")(
	function* ({
		state,
		props,
	}: {
		state: CraftInputStoreWorkingState;
		props: storeCraftInputFx.Props;
	}) {
		return yield* readCraftStoredInputsReadyFx({
			inputs: state.checked.target.recipe.inputs,
			save: state.nextSave,
			targetItemInstanceId: props.action.targetItemInstanceId,
		});
	},
);

const tryStartReadyStoredCraftInputFx = Effect.fn(
	"storeCraftInputFx.tryStartReadyStoredCraftInputFx",
)(function* ({
	state,
	props,
}: {
	state: CraftInputStoreWorkingState;
	props: storeCraftInputFx.Props;
}) {
	const storedResult = yield* buildStoredCraftInputResultFx({
		...state,
		props,
	});
	const storedInputsReady = yield* readStoredCraftInputReadyFx({
		props,
		state,
	});
	if (!storedInputsReady) return storedResult;

	const startEither = yield* Effect.either(
		startCraftFx({
			action: {
				recipeId: state.checked.target.recipeId,
				targetItemInstanceId: props.action.targetItemInstanceId,
				type: "craft.start",
			},
			config: props.config,
			nowMs: props.nowMs,
			save: state.nextSave,
		}),
	);
	if (startEither._tag === "Right") {
		return {
			events: [
				...state.events,
				...startEither.right.events,
			],
			nextWakeAtMs: startEither.right.nextWakeAtMs,
			save: startEither.right.save,
		} satisfies GameEngineResult;
	}

	const error = startEither.left;
	if (error._tag === "GameActionRejected") return storedResult;
	return yield* Effect.fail(error);
});

const storeCraftInputProgramFx = Effect.fn("storeCraftInputFx.storeCraftInputProgramFx")(function* (
	props: storeCraftInputFx.Props,
) {
	const checked = yield* readCraftInputStoreReadinessFx(props);
	const state = yield* createStoredCraftInputWorkingStateFx({
		checked,
		props,
	});
	return yield* tryStartReadyStoredCraftInputFx({
		props,
		state,
	});
});

export const storeCraftInputFx = Effect.fn("storeCraftInputFx")(function* (
	props: storeCraftInputFx.Props,
) {
	return yield* storeCraftInputProgramFx(props);
});
