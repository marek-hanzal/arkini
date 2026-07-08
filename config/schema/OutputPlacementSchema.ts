import { z } from "zod";

export const OutputPlacementSchema = z.enum([
	"target",
	"board",
	"inventory",
	"board_then_inventory",
]);
