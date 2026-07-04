import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { writeBoardItemToSaveFx } from "~/board/writeBoardItemToSaveFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readInventoryStackCapacityFx } from "~/inventory/readInventoryStackCapacityFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace checkDebugItemSpawnReadinessFx {
	export interface Props {
		action: GameActionDebugItemSpawnSchema.Type;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

type DebugSpawnReadiness = {
	item: NonNullable<GameConfig["items"][string]>;
	quantity: number;
};

const readDebugSpawnItemDefinitionFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readDebugSpawnItemDefinitionFx",
)(function* ({ action, config }: checkDebugItemSpawnReadinessFx.Props) {
	const item = config.items[action.itemId];
	if (item) return item;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
	);
});

const assertDebugSpawnStorageAllowedFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugSpawnStorageAllowedFx",
)(function* ({ action, config }: checkDebugItemSpawnReadinessFx.Props) {
	if (
		isItemStorageAllowed({
			config,
			itemId: action.itemId,
			location: action.location,
		})
	) {
		return;
	}

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"storage_restricted",
			`Item "${action.itemId}" cannot be spawned into ${action.location}.`,
		),
	);
});

const readDebugSpawnReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readDebugSpawnReadinessFx",
)(function* (props: checkDebugItemSpawnReadinessFx.Props) {
	return {
		item: yield* readDebugSpawnItemDefinitionFx(props),
		quantity: props.action.quantity ?? 1,
	} satisfies DebugSpawnReadiness;
});

const assertDebugBoardMaxCountCapacityFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugBoardMaxCountCapacityFx",
)(function* ({
	props,
	quantity,
}: {
	props: checkDebugItemSpawnReadinessFx.Props;
	quantity: number;
}) {
	const boardMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config: props.config,
		itemId: props.action.itemId,
		save: props.save,
	});
	if (boardMaxCountCapacity >= quantity) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${props.action.itemId}".`,
		),
	);
});

const readNextDebugBoardPlacementCellFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readNextDebugBoardPlacementCellFx",
)(function* ({
	props,
	simulatedSave,
}: {
	props: checkDebugItemSpawnReadinessFx.Props;
	simulatedSave: GameSave;
}) {
	const emptyCells = yield* planEmptyBoardCellsFx({
		config: props.config,
		save: simulatedSave,
	});
	if (emptyCells.length === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	}

	const [targetCell] = yield* planItemBoardPlacementCellsFx({
		config: props.config,
		itemId: props.action.itemId,
		nowMs: props.nowMs,
		save: simulatedSave,
	});
	if (targetCell) return targetCell;

	return yield* Effect.fail(
		GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
	);
});

const reserveDebugBoardPlacementCellFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.reserveDebugBoardPlacementCellFx",
)(function* ({
	index,
	item,
	props,
	simulatedSave,
}: {
	index: number;
	item: DebugSpawnReadiness["item"];
	props: checkDebugItemSpawnReadinessFx.Props;
	simulatedSave: GameSave;
}) {
	const targetCell = yield* readNextDebugBoardPlacementCellFx({
		props,
		simulatedSave,
	});
	yield* writeBoardItemToSaveFx({
		item: {
			...(item.effects?.length
				? {
						createdAtMs: props.nowMs,
					}
				: {}),
			id: `debug-readiness:${index}`,
			itemId: props.action.itemId,
			x: targetCell.x,
			y: targetCell.y,
		},
		save: simulatedSave,
	});
});

const assertDebugBoardSpawnReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugBoardSpawnReadinessFx",
)(function* ({
	props,
	readiness,
}: {
	props: checkDebugItemSpawnReadinessFx.Props;
	readiness: DebugSpawnReadiness;
}) {
	yield* assertDebugBoardMaxCountCapacityFx({
		props,
		quantity: readiness.quantity,
	});
	const simulatedSave = yield* cloneGameSaveFx({
		save: props.save,
	});
	for (let index = 0; index < readiness.quantity; index += 1) {
		yield* reserveDebugBoardPlacementCellFx({
			index,
			item: readiness.item,
			props,
			simulatedSave,
		});
	}
});

const assertDebugInventorySpawnReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugInventorySpawnReadinessFx",
)(function* ({
	props,
	readiness,
}: {
	props: checkDebugItemSpawnReadinessFx.Props;
	readiness: DebugSpawnReadiness;
}) {
	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: props.action.itemId,
		maxStackSize: readiness.item.maxStackSize,
		slots: props.save.inventory.slots,
	});
	if (inventoryCapacity >= readiness.quantity) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("inventory:full", "Inventory has no space for debug item."),
	);
});

const assertDebugSpawnLocationReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugSpawnLocationReadinessFx",
)(function* ({
	props,
	readiness,
}: {
	props: checkDebugItemSpawnReadinessFx.Props;
	readiness: DebugSpawnReadiness;
}) {
	return yield* match(props.action.location)
		.with("board", () =>
			assertDebugBoardSpawnReadinessFx({
				props,
				readiness,
			}),
		)
		.with("inventory", () =>
			assertDebugInventorySpawnReadinessFx({
				props,
				readiness,
			}),
		)
		.exhaustive();
});

export const checkDebugItemSpawnReadinessFx = Effect.fn("checkDebugItemSpawnReadinessFx")(
	function* (props: checkDebugItemSpawnReadinessFx.Props) {
		yield* assertDebugSpawnStorageAllowedFx(props);
		yield* assertDebugSpawnLocationReadinessFx({
			props,
			readiness: yield* readDebugSpawnReadinessFx(props),
		});
	},
);
