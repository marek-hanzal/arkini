import { match } from "ts-pattern";
import type { GameAction } from "~/v0/game/engine/model/GameActionSchema";

export type GameActionOfType<Type extends GameAction["type"]> = Extract<
	GameAction,
	{
		type: Type;
	}
>;

export namespace matchGameAction {
	export interface Cases<Result> {
		boardItemMove: (action: GameActionOfType<"board.item.move">) => Result;
		boardItemStash: (action: GameActionOfType<"board.item.stash">) => Result;
		boardItemsSwap: (action: GameActionOfType<"board.items.swap">) => Result;
		craftInputStore: (action: GameActionOfType<"craft.input.store">) => Result;
		craftInputWithdraw: (action: GameActionOfType<"craft.input.withdraw">) => Result;
		craftStart: (action: GameActionOfType<"craft.start">) => Result;
		inventoryItemPlace: (action: GameActionOfType<"inventory.item.place">) => Result;
		inventorySlotsSwap: (action: GameActionOfType<"inventory.slots.swap">) => Result;
		itemMerge: (action: GameActionOfType<"item.merge">) => Result;
		producerInputStore: (action: GameActionOfType<"producer.input.store">) => Result;
		producerInputWithdraw: (action: GameActionOfType<"producer.input.withdraw">) => Result;
		producerProductLineSetEnabled: (
			action: GameActionOfType<"producer.product_line.set_enabled">,
		) => Result;
		producerProductStart: (action: GameActionOfType<"producer.product.start">) => Result;
		stashOpen: (action: GameActionOfType<"stash.open">) => Result;
		storedRequirementStore: (action: GameActionOfType<"stored_requirement.store">) => Result;
		storedRequirementWithdraw: (
			action: GameActionOfType<"stored_requirement.withdraw">,
		) => Result;
		tileRemove: (action: GameActionOfType<"tile.remove">) => Result;
		upgradeStart: (action: GameActionOfType<"upgrade.start">) => Result;
	}
}

export const matchGameAction = <Result>(
	action: GameAction,
	cases: matchGameAction.Cases<Result>,
): Result =>
	match(action)
		.with(
			{
				type: "board.item.move",
			},
			cases.boardItemMove,
		)
		.with(
			{
				type: "board.item.stash",
			},
			cases.boardItemStash,
		)
		.with(
			{
				type: "board.items.swap",
			},
			cases.boardItemsSwap,
		)
		.with(
			{
				type: "craft.input.store",
			},
			cases.craftInputStore,
		)
		.with(
			{
				type: "craft.input.withdraw",
			},
			cases.craftInputWithdraw,
		)
		.with(
			{
				type: "craft.start",
			},
			cases.craftStart,
		)
		.with(
			{
				type: "inventory.item.place",
			},
			cases.inventoryItemPlace,
		)
		.with(
			{
				type: "inventory.slots.swap",
			},
			cases.inventorySlotsSwap,
		)
		.with(
			{
				type: "item.merge",
			},
			cases.itemMerge,
		)
		.with(
			{
				type: "producer.input.store",
			},
			cases.producerInputStore,
		)
		.with(
			{
				type: "producer.input.withdraw",
			},
			cases.producerInputWithdraw,
		)
		.with(
			{
				type: "producer.product_line.set_enabled",
			},
			cases.producerProductLineSetEnabled,
		)
		.with(
			{
				type: "producer.product.start",
			},
			cases.producerProductStart,
		)
		.with(
			{
				type: "stash.open",
			},
			cases.stashOpen,
		)
		.with(
			{
				type: "stored_requirement.store",
			},
			cases.storedRequirementStore,
		)
		.with(
			{
				type: "stored_requirement.withdraw",
			},
			cases.storedRequirementWithdraw,
		)
		.with(
			{
				type: "tile.remove",
			},
			cases.tileRemove,
		)
		.with(
			{
				type: "upgrade.start",
			},
			cases.upgradeStart,
		)
		.exhaustive();
