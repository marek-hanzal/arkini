import { z } from "zod";
import { CountSchema } from "./CountSchema";

export const BoardConfigSchema = z.object({
	width: CountSchema,
	height: CountSchema,
});
