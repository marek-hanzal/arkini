import { Effect } from "effect";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { resolveCraftProgress } from "~/v0/craft/logic/resolveCraftProgress";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { json } from "~/v0/serialization/json";

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
		return [] satisfies ActionVisualEventSchema.Type[];
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
			animation: ActionVisualAnimation.state({
				cause: "craft",
				groupId: `craft-start:${boardItemId}:${recipe.id}`,
			}),
			itemInstanceId: boardItemId,
			recipeId: recipe.id,
			resultItemId: recipe.resultItemId,
			readyAtMs: date.parseTimestampMs(readyAt),
		},
	] satisfies ActionVisualEventSchema.Type[];
});
