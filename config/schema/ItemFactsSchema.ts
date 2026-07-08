import { z } from "zod";
import { IdSchema } from "./IdSchema";

export const ItemFactsSchema = z.object({
	whenOwned: z.array(IdSchema).optional(),
	whenPlaced: z.array(IdSchema).optional(),
});
