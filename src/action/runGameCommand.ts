import { moveBoardItem, mergeBoardItems, swapBoardItems } from "~/board/boardEngine";
import {
	placeInventoryItem,
	stashBoardItem,
	swapInventorySlots,
} from "~/inventory/inventoryEngine";
import { activateProducer, withdrawProducerInput } from "~/producer/producerEngine";
import { buyUpgrade } from "~/upgrade/upgradeEngine";
import { bootstrapDatabase } from "~/play/logic/bootstrap";
import type { GameCommand, GameCommandResult } from "./GameCommand";

export namespace runGameCommand {
	export interface Props<Command extends GameCommand = GameCommand> {
		command: Command;
	}
}

export const runGameCommand = async <Command extends GameCommand>({
	command,
}: runGameCommand.Props<Command>): Promise<GameCommandResult<Command>> => {
	await bootstrapDatabase();

	switch (command.type) {
		case "board.move":
			return moveBoardItem({
				boardItemId: command.boardItemId,
				x: command.x,
				y: command.y,
			}) as Promise<GameCommandResult<Command>>;
		case "board.swap":
			return swapBoardItems({
				sourceBoardItemId: command.sourceBoardItemId,
				targetBoardItemId: command.targetBoardItemId,
			}) as Promise<GameCommandResult<Command>>;
		case "board.merge":
			return mergeBoardItems({
				sourceBoardItemId: command.sourceBoardItemId,
				targetBoardItemId: command.targetBoardItemId,
			}) as Promise<GameCommandResult<Command>>;
		case "inventory.swap":
			return swapInventorySlots({
				sourceSlotIndex: command.sourceSlotIndex,
				targetSlotIndex: command.targetSlotIndex,
			}) as Promise<GameCommandResult<Command>>;
		case "inventory.place":
			return placeInventoryItem({
				slotIndex: command.slotIndex,
				x: command.x,
				y: command.y,
			}) as Promise<GameCommandResult<Command>>;
		case "inventory.stash":
			return stashBoardItem({
				boardItemId: command.boardItemId,
				slotIndex: command.slotIndex,
			}) as Promise<GameCommandResult<Command>>;
		case "producer.activate":
			return activateProducer({
				boardItemId: command.boardItemId,
				activation: command.activation,
			}) as Promise<GameCommandResult<Command>>;
		case "producer.withdrawInput":
			return withdrawProducerInput({
				boardItemId: command.boardItemId,
				itemId: command.itemId,
			}) as Promise<GameCommandResult<Command>>;
		case "upgrade.buy":
			return buyUpgrade({
				upgradeId: command.upgradeId,
			}) as Promise<GameCommandResult<Command>>;
	}
};
