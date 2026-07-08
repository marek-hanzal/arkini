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

const buildStoredCraftInputStateFx = Effect.fn("storeCraftInputFx.buildStoredCraftInputStateFx")(
	function* ({
		action,
		nowMs,
		save,
		checked,
	}: {
		action: GameActionCraftInputStoreSchema.Type;
		nowMs: number;
		save: GameSave;
		checked: CraftInputStoreReadiness;
	}) {
		const nextSave = yield* cloneGameSaveFx({
			save,
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
			nowMs,
			recipeId: checked.target.recipeId,
			targetItemInstanceId: action.targetItemInstanceId,
			ref: checked.resolvedRef,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			events,
			nextSave,
		};
	},
);

const buildStoredCraftInputResultFx = Effect.fn("storeCraftInputFx.buildStoredCraftInputResultFx")(
	function* ({
		config,
		events,
		nextSave,
		nowMs,
	}: {
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		nowMs: number;
	}) {
		return yield* createGameEngineResultFx({
			config,
			events,
			nowMs,
			save: nextSave,
		});
	},
);

const readStoredCraftInputReadyFx = Effect.fn("storeCraftInputFx.readStoredCraftInputReadyFx")(
	function* ({
		targetItemInstanceId,
		inputs,
		nextSave,
	}: {
		targetItemInstanceId: string;
		inputs: CraftInputStoreReadiness["target"]["recipe"]["inputs"];
		nextSave: GameSave;
	}) {
		return yield* readCraftStoredInputsReadyFx({
			inputs,
			save: nextSave,
			targetItemInstanceId,
		});
	},
);

const tryStartReadyStoredCraftInputFx = Effect.fn(
	"storeCraftInputFx.tryStartReadyStoredCraftInputFx",
)(function* ({
		action,
		config,
		nowMs,
		checked,
		events,
		nextSave,
	}: {
		action: GameActionCraftInputStoreSchema.Type;
		config: GameConfig;
		nowMs: number;
		checked: CraftInputStoreReadiness;
		events: GameEvent[];
		nextSave: GameSave;
	}) {
		const storedResult = yield* buildStoredCraftInputResultFx({
			config,
			events,
			nextSave,
			nowMs,
		});
		const storedInputsReady = yield* readStoredCraftInputReadyFx({
			inputs: checked.target.recipe.inputs,
			nextSave,
			targetItemInstanceId: action.targetItemInstanceId,
		});
		if (!storedInputsReady) return storedResult;

		const startEither = yield* Effect.either(
			startCraftFx({
				action: {
					recipeId: checked.target.recipeId,
					targetItemInstanceId: action.targetItemInstanceId,
					type: "craft.start",
				},
				config,
				nowMs,
				save: nextSave,
			}),
		);
		if (startEither._tag === "Right") {
			return {
				events: [
					...events,
					...startEither.right.events,
				],
				nextWakeAtMs: startEither.right.nextWakeAtMs,
				save: startEither.right.save,
			} satisfies GameEngineResult;
		}

		const error = startEither.left;
		if (error._tag === "GameActionRejected") return storedResult;
		return yield* Effect.fail(error);
	},
);

export const storeCraftInputFx = Effect.fn("storeCraftInputFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: storeCraftInputFx.Props) {
	const checked = yield* checkCraftInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const { events, nextSave } = yield* buildStoredCraftInputStateFx({
		action,
		checked,
		nowMs,
		save,
	});
	return yield* tryStartReadyStoredCraftInputFx({
		action,
		checked,
		config,
		events,
		nextSave,
		nowMs,
	});
});
