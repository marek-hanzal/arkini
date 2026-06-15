import type { InventoryPlaceResult } from "~/inventory/view/InventoryPlaceResultSchema";
import type { ProducerDropResult } from "~/producer/type/ProducerDropResultSchema";
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
