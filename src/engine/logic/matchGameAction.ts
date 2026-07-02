import { match } from "ts-pattern";
import type { GameAction } from "~/action/GameActionSchema";

type GameActionOfType<Type extends GameAction["type"]> = Extract<
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
		cheatSpeedModeSet: (action: GameActionOfType<"cheat.speed_mode.set">) => Result;
		craftInputStore: (action: GameActionOfType<"craft.input.store">) => Result;
		craftInputWithdraw: (action: GameActionOfType<"craft.input.withdraw">) => Result;
		craftStart: (action: GameActionOfType<"craft.start">) => Result;
		debugItemSpawn: (action: GameActionOfType<"debug.item.spawn">) => Result;
		inventoryItemPlace: (action: GameActionOfType<"inventory.item.place">) => Result;
		inventorySlotsSwap: (action: GameActionOfType<"inventory.slots.swap">) => Result;
		itemMerge: (action: GameActionOfType<"item.merge">) => Result;
		producerInputStore: (action: GameActionOfType<"producer.input.store">) => Result;
		producerInputWithdraw: (action: GameActionOfType<"producer.input.withdraw">) => Result;
		lineSetDefault: (action: GameActionOfType<"line.set_default">) => Result;
		lineStart: (action: GameActionOfType<"line.start">) => Result;
		stashOpen: (action: GameActionOfType<"stash.open">) => Result;
		tileRemove: (action: GameActionOfType<"tile.remove">) => Result;
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
				type: "cheat.speed_mode.set",
			},
			cases.cheatSpeedModeSet,
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
				type: "debug.item.spawn",
			},
			cases.debugItemSpawn,
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
				type: "line.set_default",
			},
			cases.lineSetDefault,
		)
		.with(
			{
				type: "line.start",
			},
			cases.lineStart,
		)
		.with(
			{
				type: "stash.open",
			},
			cases.stashOpen,
		)
		.with(
			{
				type: "tile.remove",
			},
			cases.tileRemove,
		)
		.exhaustive();
