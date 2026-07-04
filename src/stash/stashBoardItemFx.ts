import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { checkBoardItemStashReadinessFx } from "~/stash/checkBoardItemStashReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { placeGameSaveInventoryInstanceFx } from "~/placement/placeGameSaveInventoryInstanceFx";
import { placeGameSaveInventoryItemsFx } from "~/placement/placeGameSaveInventoryItemsFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { GameActionBoardItemStashSchema } from "~/action/GameActionBoardItemStashSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
	const { item, stateStatus } = yield* checkBoardItemStashReadinessFx({
		action,
		config,
		save,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.board.items[item.id];

	const consumedEvent = {
		from: {
			kind: "board" as const,
			itemInstanceId: item.id,
		},
		itemId: item.itemId,
		reason: "board-stash" as const,
		type: "item.consumed" as const,
	} satisfies GameEvent;

	if (stateStatus.preservable || item.itemId === boardMemoryItemId) {
		const events: GameEvent[] = [];
		yield* placeGameSaveInventoryInstanceFx({
			config,
			createdAtMs: item.createdAtMs,
			events,
			itemId: item.itemId,
			itemInstanceId: item.id,
			reason: "board-stash",
			slots: nextSave.inventory.slots,
		}).pipe(
			Effect.catchTag("GamePlacementFailed", (error) =>
				Effect.fail(GameEngineError.actionRejected(error.reason, "Inventory is full.")),
			),
		);
		nextSave.updatedAtMs = nowMs;

		return yield* createGameEngineResultFx({
			config,
			events: [
				consumedEvent,
				...events,
			],
			nowMs,
			save: nextSave,
		});
	}

	yield* removeBoardItemRuntimeStateFx({
		itemInstanceId: item.id,
		save: nextSave,
	});

	const placed = yield* placeGameSaveInventoryItemsFx({
		config,
		items: [
			{
				createdAtMs: item.createdAtMs,
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

	return yield* createGameEngineResultFx({
		config,
		events: [
			consumedEvent,
			...placed.events,
		],
		nowMs,
		save: placed.save,
	});
});
