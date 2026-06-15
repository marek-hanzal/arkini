import type { InventoryPlaceResult } from "~/inventory/view/InventoryPlaceResultSchema";
import type { ActivationResultSchema } from "~/activation/type/ActivationResultSchema";
import type { Command } from "./Command";

export type CommandResult<TCommand extends Command = Command> = TCommand extends {
	type: "activation.activate";
}
	? ActivationResultSchema.Type
	: TCommand extends {
				type: "inventory.place";
			}
		? InventoryPlaceResult
		: void;
