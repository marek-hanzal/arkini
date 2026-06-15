import { z } from "zod";
import { BoardMergeCommandSchema } from "./BoardMergeCommandSchema";
import { BoardMoveCommandSchema } from "./BoardMoveCommandSchema";
import { BoardSwapCommandSchema } from "./BoardSwapCommandSchema";
import { InventoryPlaceCommandSchema } from "./InventoryPlaceCommandSchema";
import { InventoryStashCommandSchema } from "./InventoryStashCommandSchema";
import { InventorySwapCommandSchema } from "./InventorySwapCommandSchema";
import { ActivationActivateCommandSchema } from "./ActivationActivateCommandSchema";
import { ActivationWithdrawInputCommandSchema } from "./ActivationWithdrawInputCommandSchema";
import { UpgradeBuyCommandSchema } from "./UpgradeBuyCommandSchema";

export const CommandSchema = z.discriminatedUnion("type", [
	BoardMoveCommandSchema,
	BoardSwapCommandSchema,
	BoardMergeCommandSchema,
	InventorySwapCommandSchema,
	InventoryPlaceCommandSchema,
	InventoryStashCommandSchema,
	ActivationActivateCommandSchema,
	ActivationWithdrawInputCommandSchema,
	UpgradeBuyCommandSchema,
]);

type CommandSchema = typeof CommandSchema;
export namespace CommandSchema {
	export type Type = z.infer<CommandSchema>;
}
