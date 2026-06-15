import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";
import { GameActionError } from "~/command/GameActionError";
import { resolveCraftProgress } from "~/craft/logic/resolveCraftProgress";
import { dbFx } from "~/database/fx/dbFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { json } from "~/shared/json";

export namespace startCraftFx {
	export interface Props {
		boardItemId: string;
		itemId: ItemId;
		state: BoardItemState;
		storedInputs?: ReadonlyMap<ItemId, number>;
	}
}

export const startCraftFx = Effect.fn("startCraftFx")(function* ({
	boardItemId,
	itemId,
	state,
	storedInputs,
}: startCraftFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const recipe = gameConfig.getCraftRecipeForTarget(itemId);
	if (!recipe) {
		return yield* Effect.fail(new GameActionError("This item cannot craft anything."));
	}

	const progress = resolveCraftProgress({
		recipe,
		storedInputs,
	});
	if (!progress.inputsComplete) {
		return yield* Effect.fail(new GameActionError("Craft inputs are incomplete."));
	}
	if (state.craft?.startedAt || state.craft?.readyAt) {
		return [] satisfies CommandVisualEventSchema.Type[];
	}

	const now = date.now();
	const startedAt = date.toTimestamp(now);
	const readyAt = date.toTimestamp(
		now.plus({
			milliseconds: recipe.durationMs,
		}),
	);
	const baseState = {
		...createInitialBoardState(itemId, gameConfig),
		...state,
	};
	const nextState = {
		...baseState,
		craft: {
			startedAt,
			readyAt,
		},
	} satisfies BoardItemState;

	yield* dbFx((db) =>
		db
			.updateTable("itemInstance")
			.set({
				stateJson: json(nextState),
				updatedAt: startedAt,
			})
			.where("id", "=", boardItemId)
			.execute(),
	);

	return [
		{
			type: "craft.started",
			itemInstanceId: boardItemId,
			recipeId: recipe.id,
			resultItemId: recipe.resultItemId,
			readyAtMs: date.parseTimestampMs(readyAt),
		},
	] satisfies CommandVisualEventSchema.Type[];
});
