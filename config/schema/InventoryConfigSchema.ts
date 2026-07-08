import { z } from "zod";
import { CountSchema } from "./CountSchema";

export const InventoryConfigSchema = z.object({
	slots: CountSchema,
});
