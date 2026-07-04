import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import { assertBoardCellInsideBoundsFx } from "~/board/assertBoardCellInsideBoundsFx";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import { readInventorySlotAfterQuantityRemovalFx } from "~/inventory/readInventorySlotAfterQuantityRemovalFx";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
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
)(function* ({ action, config }: checkInventoryItemPlaceReadinessFx.Props) {
	yield* assertBoardCellInsideBoundsFx({
		config,
		x: action.x,
		y: action.y,
	});
});

const readInventoryPlacementSlotFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.readInventoryPlacementSlotFx",
)(function* ({ action, save }: checkInventoryItemPlaceReadinessFx.Props) {
	const slot = save.inventory.slots[action.slotIndex];
	if (slot) return slot;

	return yield* Effect.fail(
		GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
	);
});

const assertInventoryPlacementStorageFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertInventoryPlacementStorageFx",
)(function* ({ config, slot }: { config: GameConfig; slot: InventoryPlacementSlot }) {
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
)(function* ({
	action,
	slot,
}: {
	action: GameActionInventoryItemPlaceSchema.Type;
	slot: InventoryPlacementSlot;
}) {
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
)(function* (props: checkInventoryItemPlaceReadinessFx.Props) {
	const slot = yield* readInventoryPlacementSlotFx(props);
	const itemDefinition = yield* readGameConfigItemDefinitionFx({
		config: props.config,
		itemId: slot.itemId,
	});
	yield* assertInventoryPlacementStorageFx({
		config: props.config,
		slot,
	});
	const quantity = yield* readInventoryPlacementQuantityFx({
		action: props.action,
		slot,
	});

	return {
		itemDefinition,
		placementMode: props.action.placementMode ?? "exact",
		quantity,
		saveAfterInventoryRemoval: yield* readSaveAfterInventoryRemovalPreviewFx({
			quantity,
			save: props.save,
			slotIndex: props.action.slotIndex,
		}),
		slot,
	} satisfies InventoryPlacementDraft;
});

const assertExactPlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertExactPlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: checkInventoryItemPlaceReadinessFx.Props;
}) {
	if (draft.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Exact inventory placement supports a single item only.",
			),
		);
	}

	const occupied = yield* readBoardItemAtCellFx({
		save: props.save,
		x: props.action.x,
		y: props.action.y,
	});
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config: props.config,
		itemId: draft.slot.itemId,
		save: props.save,
	});
	if (boardItemMaxCountCapacity > 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${draft.slot.itemId}".`,
		),
	);
});

const assertNearestInstancePlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertNearestInstancePlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: checkInventoryItemPlaceReadinessFx.Props;
}) {
	if (draft.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory instance placement supports a single item only.",
			),
		);
	}

	const boardPlacementCapacity = yield* readBoardPlacementCapacityFx({
		config: props.config,
		itemId: draft.slot.itemId,
		save: props.save,
	});
	if (boardPlacementCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config: props.config,
					itemId: draft.slot.itemId,
					save: props.save,
				}),
				"No board placement target available.",
			),
		);
	}

	const [targetCell] = yield* planItemBoardPlacementCellsFx({
		config: props.config,
		itemId: draft.slot.itemId,
		nowMs: props.nowMs,
		save: draft.saveAfterInventoryRemoval,
		seedCell: {
			x: props.action.x,
			y: props.action.y,
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
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: checkInventoryItemPlaceReadinessFx.Props;
}) {
	const boardCapacity = yield* readBoardPlacementCapacityFx({
		config: props.config,
		itemId: draft.slot.itemId,
		save: props.save,
	});
	const boardPlacementCells =
		boardCapacity > 0
			? yield* planItemBoardPlacementCellsFx({
					config: props.config,
					itemId: draft.slot.itemId,
					nowMs: props.nowMs,
					save: draft.saveAfterInventoryRemoval,
					seedCell: {
						x: props.action.x,
						y: props.action.y,
					},
				})
			: [];
	const allowedBoardCapacity = Math.min(boardCapacity, boardPlacementCells.length);
	if (allowedBoardCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config: props.config,
					itemId: draft.slot.itemId,
					save: props.save,
				}),
				"No board placement target available.",
			),
		);
	}

	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: draft.slot.itemId,
		maxStackSize: draft.itemDefinition.maxStackSize,
		slots: draft.saveAfterInventoryRemoval.inventory.slots,
	});
	if (draft.quantity <= allowedBoardCapacity + inventoryCapacity) return;

	const reason =
		boardCapacity === 0
			? yield* readBoardPlacementBlockReasonFx({
					config: props.config,
					itemId: draft.slot.itemId,
					save: props.save,
				})
			: "inventory:full";
	return yield* Effect.fail(
		GameEngineError.actionRejected(reason, "No placement target available."),
	);
});

const assertNearestPlacementReadinessFx = Effect.fn(
	"checkInventoryItemPlaceReadinessFx.assertNearestPlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: checkInventoryItemPlaceReadinessFx.Props;
}) {
	yield* match(draft)
		.with(
			{
				slot: P.when(isGameSaveInventoryInstance),
			},
			() =>
				assertNearestInstancePlacementReadinessFx({
					draft,
					props,
				}),
		)
		.with(
			{
				slot: P.when(isGameSaveInventoryStack),
			},
			() =>
				assertNearestStackPlacementReadinessFx({
					draft,
					props,
				}),
		)
		.exhaustive();
});

export const checkInventoryItemPlaceReadinessFx = Effect.fn("checkInventoryItemPlaceReadinessFx")(
	function* (props: checkInventoryItemPlaceReadinessFx.Props) {
		yield* assertTargetCellInsideBoardFx(props);
		const draft = yield* readInventoryPlacementDraftFx(props);
		yield* match(draft.placementMode)
			.with("exact", () =>
				assertExactPlacementReadinessFx({
					draft,
					props,
				}),
			)
			.with("nearest_by_manhattan", () =>
				assertNearestPlacementReadinessFx({
					draft,
					props,
				}),
			)
			.exhaustive();

		return {
			itemDefinition: draft.itemDefinition,
			slot: draft.slot,
		};
	},
);
