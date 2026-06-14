import { merge } from "~/board/merge";
import { move } from "~/board/move";
import { swap } from "~/board/swap";
import { place } from "~/inventory/place";
import { stash } from "~/inventory/stash";
import { swap as swapInventory } from "~/inventory/swap";
import { activate } from "~/producer/activate";
import { withdrawInput } from "~/producer/withdrawInput";
import { buy } from "~/upgrade/buy";
import { bootstrapDatabase } from "~/play/logic/bootstrapDatabase";
import type { Command, CommandResult } from "./command";

export namespace run {
	export interface Props<TCommand extends Command = Command> {
		command: TCommand;
	}
}

export const run = async <TCommand extends Command>({
	command,
}: run.Props<TCommand>): Promise<CommandResult<TCommand>> => {
	await bootstrapDatabase();

	switch (command.type) {
		case "board.move":
			return move({
				boardItemId: command.boardItemId,
				x: command.x,
				y: command.y,
			}) as Promise<CommandResult<TCommand>>;
		case "board.swap":
			return swap({
				sourceBoardItemId: command.sourceBoardItemId,
				targetBoardItemId: command.targetBoardItemId,
			}) as Promise<CommandResult<TCommand>>;
		case "board.merge":
			return merge({
				sourceBoardItemId: command.sourceBoardItemId,
				targetBoardItemId: command.targetBoardItemId,
			}) as Promise<CommandResult<TCommand>>;
		case "inventory.swap":
			return swapInventory({
				sourceSlotIndex: command.sourceSlotIndex,
				targetSlotIndex: command.targetSlotIndex,
			}) as Promise<CommandResult<TCommand>>;
		case "inventory.place":
			return place({
				slotIndex: command.slotIndex,
				x: command.x,
				y: command.y,
			}) as Promise<CommandResult<TCommand>>;
		case "inventory.stash":
			return stash({
				boardItemId: command.boardItemId,
				slotIndex: command.slotIndex,
			}) as Promise<CommandResult<TCommand>>;
		case "producer.activate":
			return activate({
				boardItemId: command.boardItemId,
				activation: command.activation,
			}) as Promise<CommandResult<TCommand>>;
		case "producer.withdrawInput":
			return withdrawInput({
				boardItemId: command.boardItemId,
				itemId: command.itemId,
			}) as Promise<CommandResult<TCommand>>;
		case "upgrade.buy":
			return buy({
				upgradeId: command.upgradeId,
			}) as Promise<CommandResult<TCommand>>;
	}
};
