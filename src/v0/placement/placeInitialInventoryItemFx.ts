import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readGameConfigItemDefinitionFx } from "~/config/readGameConfigItemDefinitionFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";

export namespace placeInitialInventoryItemFx {
	export interface Props {
		config: GameConfig;
		inventorySlots: GameSaveInventorySlot[];
		itemId: string;
		nowMs: number;
		quantity: number;
	}
}

const assertStartingInventoryStorageAllowedFx = Effect.fn(
	"placeInitialInventoryItemFx.assertStartingInventoryStorageAllowedFx",
)(function* ({ config, itemId }: { config: GameConfig; itemId: string }) {
	if (
		isItemStorageAllowed({
			config,
			itemId,
			location: "inventory",
		})
	) {
		return;
	}

	return yield* Effect.fail(
		GameEngineError.saveInvalid(`Starting inventory cannot contain "${itemId}".`),
	);
});

export const placeInitialInventoryItemFx = Effect.fn("placeInitialInventoryItemFx")(function* ({
	config,
	inventorySlots,
	itemId,
	nowMs,
	quantity,
}: placeInitialInventoryItemFx.Props) {
	const item = yield* readGameConfigItemDefinitionFx({
		config,
		itemId,
	});
	yield* assertStartingInventoryStorageAllowedFx({
		config,
		itemId,
	});

	const events: GameEvent[] = [];
	const placed = yield* placeGameSaveInventoryRemainderFx({
		createdAtMs: item.effects?.length ? nowMs : undefined,
		events,
		item: {
			itemId,
			quantity,
		},
		maxStackSize: item.maxStackSize,
		remainingQuantity: quantity,
		slots: inventorySlots,
	});
	if (placed) return;

	return yield* Effect.fail(
		GameEngineError.saveInvalid(`Starting inventory cannot fit ${quantity} of "${itemId}".`),
	);
});
