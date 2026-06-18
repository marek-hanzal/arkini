import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/engine/fx/removeBoardItemRuntimeState";
import { placeGameSaveInventoryItemsFx } from "~/v0/game/engine/fx/placeGameSaveInventoryItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameActionBoardItemStashSchema } from "~/v0/game/engine/model/GameActionBoardItemStashSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace stashBoardItemFx {
	export interface Props {
		action: GameActionBoardItemStashSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const stashBoardItemFx = Effect.fn("stashBoardItemFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: stashBoardItemFx.Props) {
	const item = save.board.items[action.boardItemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Board item does not exist."),
		);
	}
	if (!config.items[item.itemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.board.items[item.id];
	removeBoardItemRuntimeState({
		itemInstanceId: item.id,
		save: nextSave,
	});

	const placed = yield* placeGameSaveInventoryItemsFx({
		config,
		items: [
			{
				itemId: item.itemId,
				originItemInstanceId: item.id,
				quantity: 1,
				reason: "board-stash",
			},
		],
		nowMs,
		save: nextSave,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(GameEngineError.actionRejected(error.reason, "Inventory is full.")),
		),
	);

	placed.save.updatedAtMs = nowMs;

	return {
		events: [
			{
				from: {
					kind: "board" as const,
					itemInstanceId: item.id,
				},
				itemId: item.itemId,
				reason: "board-stash" as const,
				type: "item.consumed" as const,
			},
			...placed.events,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: placed.save,
		}),
		save: placed.save,
	} satisfies GameEngineResult;
});
