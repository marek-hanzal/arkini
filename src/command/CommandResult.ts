import type { InventoryPlaceResult, ProducerDropResult } from "~/play/logic/playTypes";
import type { Command } from "./Command";

export type CommandResult<TCommand extends Command = Command> = TCommand extends {
	type: "producer.activate";
}
	? ProducerDropResult
	: TCommand extends {
				type: "inventory.place";
			}
		? InventoryPlaceResult
		: void;
