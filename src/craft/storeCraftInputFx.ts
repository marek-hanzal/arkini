import { Context, Effect } from "effect";
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

class StoreCraftInputScopeFx extends Context.Tag("StoreCraftInputScopeFx")<
	StoreCraftInputScopeFx,
	storeCraftInputFx.Props
>() {
	//
}

const readCraftInputStoreReadinessFx = Effect.fn(
	"storeCraftInputFx.readCraftInputStoreReadinessFx",
)(function* () {
	const { action, config, nowMs, save } = yield* StoreCraftInputScopeFx;
	return yield* checkCraftInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createStoredCraftInputWorkingStateFx = Effect.fn(
	"storeCraftInputFx.createStoredCraftInputWorkingStateFx",
)(function* ({ checked }: { checked: CraftInputStoreReadiness }) {
	const { action, nowMs, save } = yield* StoreCraftInputScopeFx;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "craft-input-store",
		ref: checked.resolvedRef,
	});
	yield* storeCraftResolvedInputFx({
		events,
		nextSave,
		nowMs,
		recipeId: checked.target.recipeId,
		targetItemInstanceId: action.targetItemInstanceId,
		ref: checked.resolvedRef,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		checked,
		events,
		nextSave,
	} satisfies CraftInputStoreWorkingState;
});

const buildStoredCraftInputResultFx = Effect.fn("storeCraftInputFx.buildStoredCraftInputResultFx")(
	function* ({ events, nextSave }: Pick<CraftInputStoreWorkingState, "events" | "nextSave">) {
		const { config, nowMs } = yield* StoreCraftInputScopeFx;
		return yield* createGameEngineResultFx({
			config,
			events,
			nowMs,
			save: nextSave,
		});
	},
);

const readStoredCraftInputReadyFx = Effect.fn("storeCraftInputFx.readStoredCraftInputReadyFx")(
	function* ({ checked, nextSave }: CraftInputStoreWorkingState) {
		const { action } = yield* StoreCraftInputScopeFx;
		return yield* readCraftStoredInputsReadyFx({
			inputs: checked.target.recipe.inputs,
			save: nextSave,
			targetItemInstanceId: action.targetItemInstanceId,
		});
	},
);

const tryStartReadyStoredCraftInputFx = Effect.fn(
	"storeCraftInputFx.tryStartReadyStoredCraftInputFx",
)(function* (state: CraftInputStoreWorkingState) {
	const { action, config, nowMs } = yield* StoreCraftInputScopeFx;
	const storedResult = yield* buildStoredCraftInputResultFx(state);
	const storedInputsReady = yield* readStoredCraftInputReadyFx(state);
	if (!storedInputsReady) return storedResult;

	const startEither = yield* Effect.either(
		startCraftFx({
			action: {
				recipeId: state.checked.target.recipeId,
				targetItemInstanceId: action.targetItemInstanceId,
				type: "craft.start",
			},
			config,
			nowMs,
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

const storeCraftInputProgramFx = Effect.fn("storeCraftInputFx.storeCraftInputProgramFx")(
	function* () {
		const checked = yield* readCraftInputStoreReadinessFx();
		const state = yield* createStoredCraftInputWorkingStateFx({
			checked,
		});
		return yield* tryStartReadyStoredCraftInputFx(state);
	},
);

export const storeCraftInputFx = Effect.fn("storeCraftInputFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: storeCraftInputFx.Props) {
	return yield* storeCraftInputProgramFx().pipe(
		Effect.provideService(StoreCraftInputScopeFx, {
			action,
			config,
			nowMs,
			save,
		}),
	);
});
