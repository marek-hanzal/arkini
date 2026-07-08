import { z } from "zod";
import { BoardPlacementSchema } from "./BoardPlacementSchema";
import { InventoryPlacementSchema } from "./InventoryPlacementSchema";

export const StartingStateSchema = z.object({
	board: z.array(BoardPlacementSchema).optional(),
	inventory: z.array(InventoryPlacementSchema).optional(),
});
