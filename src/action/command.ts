import type { InventoryPlaceResult, ProducerDropResult } from "~/play/logic/playTypes";

export type Command =
	| {
			type: "board.move";
			boardItemId: string;
			x: number;
			y: number;
	  }
	| {
			type: "board.swap";
			sourceBoardItemId: string;
			targetBoardItemId: string;
	  }
	| {
			type: "board.merge";
			sourceBoardItemId: string;
			targetBoardItemId: string;
	  }
	| {
			type: "inventory.swap";
			sourceSlotIndex: number;
			targetSlotIndex: number;
	  }
	| {
			type: "inventory.place";
			slotIndex: number;
			x: number;
			y: number;
	  }
	| {
			type: "inventory.stash";
			boardItemId: string;
			slotIndex?: number;
	  }
	| {
			type: "producer.activate";
			boardItemId: string;
			activation?: "single" | "exhaust";
	  }
	| {
			type: "producer.withdrawInput";
			boardItemId: string;
			itemId: string;
	  }
	| {
			type: "upgrade.buy";
			upgradeId: string;
	  };

export type CommandResult<TCommand extends Command = Command> = TCommand extends {
	type: "producer.activate";
}
	? ProducerDropResult
	: TCommand extends {
				type: "inventory.place";
			}
		? InventoryPlaceResult
		: void;
