import { Context, Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import { assertBoardCellInsideBoundsFx } from "~/board/assertBoardCellInsideBoundsFx";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import { readInventorySlotAfterQuantityRemovalFx } from "~/inventory/readInventorySlotAfterQuantityRemovalFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";

export namespace checkInventoryItemPlaceReadinessFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

type InventoryPlacementMode = NonNullable<GameActionInventoryItemPlaceSchema.Type["placementMode"]>;

type InventoryPlacementSlot = Exclude<GameSaveInventorySlot, null>;

type InventoryPlacementDraft = {
	itemDefinition: GameConfig["items"][string];
	placementMode: InventoryPlacementMode;
	quantity: number;
	saveAfterInventoryRemoval: GameSave;
	slot: InventoryPlacementSlot;
};

class InventoryItemPlaceReadinessScopeFx extends Context.Tag("InventoryItemPlaceReadinessScopeFx")<
	InventoryItemPlaceReadinessScopeFx,
	checkInventoryItemPlaceReadinessFx.Props
>() {
	//
}

const readEmptyBoardCellCountFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readEmptyBoardCellCountFx",
)(function* ({ config, save }: { config: GameConfig; save: GameSave }) {
	const boardCellCount = config.game.board.width * config.game.board.height;
	return Math.max(0, boardCellCount - Object.keys(save.board.items).length);
});

const readBoardPlacementCapacityFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readBoardPlacementCapacityFx",
)(function* ({ config, itemId, save }: { config: GameConfig; itemId: string; save: GameSave }) {
	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId,
		save,
	});
	return Math.min(
		yield* readEmptyBoardCellCountFx({
			config,
			save,
		}),
		boardItemMaxCountCapacity,
	);
});

const readBoardPlacementBlockReasonFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readBoardPlacementBlockReasonFx",
)(function* ({ config, itemId, save }: { config: GameConfig; itemId: string; save: GameSave }) {
	return (yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId,
		save,
	})) <= 0
		? "board:max-count"
		: "board:full";
});

const readSaveAfterInventoryRemovalPreviewFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readSaveAfterInventoryRemovalPreviewFx",
)(function* ({
	quantity,
	save,
	slotIndex,
}: {
	quantity: number;
	save: GameSave;
	slotIndex: number;
}) {
	const slots = [];
	for (const [index, slot] of save.inventory.slots.entries()) {
		slots.push(
			index === slotIndex
				? yield* readInventorySlotAfterQuantityRemovalFx({
						quantity,
						slot,
					})
				: slot,
		);
	}

	return {
		...save,
		inventory: {
			...save.inventory,
			slots,
		},
	};
});

const assertTargetCellInsideBoardFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertTargetCellInsideBoardFx",
)(function* () {
	const { action, config } = yield* InventoryItemPlaceReadinessScopeFx;
	yield* assertBoardCellInsideBoundsFx({
		config,
		x: action.x,
		y: action.y,
	});
});

const readInventoryPlacementSlotFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readInventoryPlacementSlotFx",
)(function* () {
	const { action, save } = yield* InventoryItemPlaceReadinessScopeFx;
	const slot = save.inventory.slots[action.slotIndex];
	if (slot) return slot;

	return yield* Effect.fail(
		GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
	);
});

const assertInventoryPlacementStorageFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertInventoryPlacementStorageFx",
)(function* ({ slot }: { slot: InventoryPlacementSlot }) {
	const { config } = yield* InventoryItemPlaceReadinessScopeFx;
	if (
		isItemStorageAllowed({
			config,
			itemId: slot.itemId,
			location: "board",
		})
	) {
		return;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"storage_restricted",
			`Item "${slot.itemId}" cannot be placed on board.`,
		),
	);
});

const readInventoryPlacementQuantityFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readInventoryPlacementQuantityFx",
)(function* ({ slot }: { slot: InventoryPlacementSlot }) {
	const { action } = yield* InventoryItemPlaceReadinessScopeFx;
	const quantity = action.quantity ?? 1;
	const slotQuantity = readGameSaveInventorySlotQuantity(slot);
	if (quantity <= slotQuantity) return quantity;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"input_unavailable",
			`Inventory slot has ${slotQuantity} item(s), cannot place ${quantity}.`,
		),
	);
});

const readInventoryPlacementDraftFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readInventoryPlacementDraftFx",
)(function* () {
	const { action, config, save } = yield* InventoryItemPlaceReadinessScopeFx;
	const slot = yield* readInventoryPlacementSlotFx();
	const itemDefinition = yield* readGameConfigItemDefinitionFx({
		config,
		itemId: slot.itemId,
	});
	yield* assertInventoryPlacementStorageFx({
		slot,
	});
	const quantity = yield* readInventoryPlacementQuantityFx({
		slot,
	});

	return {
		itemDefinition,
		placementMode: action.placementMode ?? "exact",
		quantity,
		saveAfterInventoryRemoval: yield* readSaveAfterInventoryRemovalPreviewFx({
			quantity,
			save,
			slotIndex: action.slotIndex,
		}),
		slot,
	} satisfies InventoryPlacementDraft;
});

const assertExactPlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertExactPlacementReadinessFx",
)(function* ({ quantity, slot }: InventoryPlacementDraft) {
	const { action, config, save } = yield* InventoryItemPlaceReadinessScopeFx;
	if (quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Exact inventory placement supports a single item only.",
			),
		);
	}

	const occupied = yield* readBoardItemAtCellFx({
		save,
		x: action.x,
		y: action.y,
	});
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId: slot.itemId,
		save,
	});
	if (boardItemMaxCountCapacity > 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${slot.itemId}".`,
		),
	);
});

const assertNearestInstancePlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertNearestInstancePlacementReadinessFx",
)(function* ({ quantity, saveAfterInventoryRemoval, slot }: InventoryPlacementDraft) {
	const { action, config, nowMs, save } = yield* InventoryItemPlaceReadinessScopeFx;
	if (quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory instance placement supports a single item only.",
			),
		);
	}

	const boardPlacementCapacity = yield* readBoardPlacementCapacityFx({
		config,
		itemId: slot.itemId,
		save,
	});
	if (boardPlacementCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config,
					itemId: slot.itemId,
					save,
				}),
				"No board placement target available.",
			),
		);
	}

	const [targetCell] = yield* planItemBoardPlacementCellsFx({
		config,
		itemId: slot.itemId,
		nowMs,
		save: saveAfterInventoryRemoval,
		seedCell: {
			x: action.x,
			y: action.y,
		},
	});
	if (targetCell) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("board:full", "No board placement target available."),
	);
});

const assertNearestStackPlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertNearestStackPlacementReadinessFx",
)(function* ({
	itemDefinition,
	quantity,
	saveAfterInventoryRemoval,
	slot,
}: InventoryPlacementDraft) {
	const { action, config, nowMs, save } = yield* InventoryItemPlaceReadinessScopeFx;
	const boardCapacity = yield* readBoardPlacementCapacityFx({
		config,
		itemId: slot.itemId,
		save,
	});
	const boardPlacementCells =
		boardCapacity > 0
			? yield* planItemBoardPlacementCellsFx({
					config,
					itemId: slot.itemId,
					nowMs,
					save: saveAfterInventoryRemoval,
					seedCell: {
						x: action.x,
						y: action.y,
					},
				})
			: [];
	const allowedBoardCapacity = Math.min(boardCapacity, boardPlacementCells.length);
	if (allowedBoardCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config,
					itemId: slot.itemId,
					save,
				}),
				"No board placement target available.",
			),
		);
	}

	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: slot.itemId,
		maxStackSize: itemDefinition.maxStackSize,
		slots: saveAfterInventoryRemoval.inventory.slots,
	});
	if (quantity <= allowedBoardCapacity + inventoryCapacity) return;

	const reason =
		boardCapacity === 0
			? yield* readBoardPlacementBlockReasonFx({
					config,
					itemId: slot.itemId,
					save,
				})
			: "inventory:full";
	return yield* Effect.fail(
		GameEngineError.actionRejected(reason, "No placement target available."),
	);
});

const assertNearestPlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertNearestPlacementReadinessFx",
)(function* (draft: InventoryPlacementDraft) {
	yield* match(draft)
		.with(
			{
				slot: P.when(isGameSaveInventoryInstance),
			},
			assertNearestInstancePlacementReadinessFx,
		)
		.with(
			{
				slot: P.when(isGameSaveInventoryStack),
			},
			assertNearestStackPlacementReadinessFx,
		)
		.exhaustive();
});

const checkInventoryItemPlaceReadinessProgramFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.programFx",
)(function* () {
	yield* assertTargetCellInsideBoardFx();
	const draft = yield* readInventoryPlacementDraftFx();
	yield* match(draft.placementMode)
		.with("exact", () => assertExactPlacementReadinessFx(draft))
		.with("nearest_by_manhattan", () => assertNearestPlacementReadinessFx(draft))
		.exhaustive();

	return {
		itemDefinition: draft.itemDefinition,
		slot: draft.slot,
	};
});

export const checkInventoryItemPlaceReadinessFx = Effect.fn("checkInventoryItemPlaceReadinessFx")(
	function* (props: checkInventoryItemPlaceReadinessFx.Props) {
		return yield* checkInventoryItemPlaceReadinessProgramFx().pipe(
			Effect.provideService(InventoryItemPlaceReadinessScopeFx, props),
		);
	},
);
