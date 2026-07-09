import { z } from "zod";

export const ChanceSchema = z.number().min(0).max(1).meta({
	id: "ChanceSchema",
	description: "A probability from zero to one inclusive.",
});

export type ChanceSchema = typeof ChanceSchema;

export namespace ChanceSchema {
	export type Type = z.infer<ChanceSchema>;
}
