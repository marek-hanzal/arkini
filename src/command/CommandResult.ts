import type { ActivationResultSchema } from "~/activation/type/ActivationResultSchema";
import type { InventoryPlaceResult } from "~/inventory/view/InventoryPlaceResultSchema";
import type { Command } from "./Command";
import type { CommandResultSchema } from "./CommandResultSchema";

export type CommandResult<TCommand extends Command = Command> = CommandResultSchema.Type &
	(TCommand extends {
		type: "activation.activate";
	}
		? {
				activation: ActivationResultSchema.Type;
			}
		: TCommand extends {
					type: "inventory.place";
				}
			? {
					inventoryPlace: InventoryPlaceResult;
				}
			: Record<never, never>);
