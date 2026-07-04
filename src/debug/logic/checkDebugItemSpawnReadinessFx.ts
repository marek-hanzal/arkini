import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
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

class DebugItemSpawnReadinessScopeFx extends Context.Tag("DebugItemSpawnReadinessScopeFx")<
	DebugItemSpawnReadinessScopeFx,
	checkDebugItemSpawnReadinessFx.Props
>() {
	//
}

const readDebugSpawnItemDefinitionFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readDebugSpawnItemDefinitionFx",
)(function* () {
	const { action, config } = yield* DebugItemSpawnReadinessScopeFx;
	const item = config.items[action.itemId];
	if (item) return item;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
	);
});

const assertDebugSpawnStorageAllowedFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugSpawnStorageAllowedFx",
)(function* () {
	const { action, config } = yield* DebugItemSpawnReadinessScopeFx;
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
)(function* () {
	return {
		item: yield* readDebugSpawnItemDefinitionFx(),
		quantity: (yield* DebugItemSpawnReadinessScopeFx).action.quantity ?? 1,
	} satisfies DebugSpawnReadiness;
});

const assertDebugBoardMaxCountCapacityFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugBoardMaxCountCapacityFx",
)(function* ({ quantity }: DebugSpawnReadiness) {
	const { action, config, save } = yield* DebugItemSpawnReadinessScopeFx;
	const boardMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		itemId: action.itemId,
		save,
	});
	if (boardMaxCountCapacity >= quantity) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${action.itemId}".`,
		),
	);
});

const readNextDebugBoardPlacementCellFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readNextDebugBoardPlacementCellFx",
)(function* ({ simulatedSave }: { simulatedSave: GameSave }) {
	const { action, config, nowMs } = yield* DebugItemSpawnReadinessScopeFx;
	const emptyCells = yield* planEmptyBoardCellsFx({
		config,
		save: simulatedSave,
	});
	if (emptyCells.length === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("board:full", "Board has no space for debug item."),
		);
	}

	const [targetCell] = yield* planItemBoardPlacementCellsFx({
		config,
		itemId: action.itemId,
		nowMs,
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
	simulatedSave,
}: DebugSpawnReadiness & {
	index: number;
	simulatedSave: GameSave;
}) {
	const { action, nowMs } = yield* DebugItemSpawnReadinessScopeFx;
	const targetCell = yield* readNextDebugBoardPlacementCellFx({
		simulatedSave,
	});
	simulatedSave.board.items[`debug-readiness:${index}`] = {
		...(item.effects?.length
			? {
					createdAtMs: nowMs,
				}
			: {}),
		id: `debug-readiness:${index}`,
		itemId: action.itemId,
		x: targetCell.x,
		y: targetCell.y,
	};
});

const assertDebugBoardSpawnReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugBoardSpawnReadinessFx",
)(function* (readiness: DebugSpawnReadiness) {
	const { save } = yield* DebugItemSpawnReadinessScopeFx;
	yield* assertDebugBoardMaxCountCapacityFx(readiness);
	const simulatedSave = yield* cloneGameSaveFx({
		save,
	});
	for (let index = 0; index < readiness.quantity; index += 1) {
		yield* reserveDebugBoardPlacementCellFx({
			...readiness,
			index,
			simulatedSave,
		});
	}
});

const assertDebugInventorySpawnReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugInventorySpawnReadinessFx",
)(function* ({ item, quantity }: DebugSpawnReadiness) {
	const { action, save } = yield* DebugItemSpawnReadinessScopeFx;
	const inventoryCapacity = yield* readInventoryStackCapacityFx({
		itemId: action.itemId,
		maxStackSize: item.maxStackSize,
		slots: save.inventory.slots,
	});
	if (inventoryCapacity >= quantity) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("inventory:full", "Inventory has no space for debug item."),
	);
});

const assertDebugSpawnLocationReadinessFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.assertDebugSpawnLocationReadinessFx",
)(function* (readiness: DebugSpawnReadiness) {
	const { action } = yield* DebugItemSpawnReadinessScopeFx;
	return yield* match(action.location)
		.with("board", () => assertDebugBoardSpawnReadinessFx(readiness))
		.with("inventory", () => assertDebugInventorySpawnReadinessFx(readiness))
		.exhaustive();
});

const checkDebugItemSpawnReadinessProgramFx = Effect.fn("checkDebugItemSpawnReadinessFx.programFx")(
	function* () {
		yield* assertDebugSpawnStorageAllowedFx();
		yield* assertDebugSpawnLocationReadinessFx(yield* readDebugSpawnReadinessFx());
	},
);

export const checkDebugItemSpawnReadinessFx = Effect.fn("checkDebugItemSpawnReadinessFx")(
	function* (props: checkDebugItemSpawnReadinessFx.Props) {
		return yield* checkDebugItemSpawnReadinessProgramFx().pipe(
			Effect.provideService(DebugItemSpawnReadinessScopeFx, props),
		);
	},
);
