import { z } from "zod";

export const NonNegativeIntegerSchema = z.number().int().min(0).meta({
	id: "NonNegativeIntegerSchema",
	description: "A whole number greater than or equal to zero.",
});

export type NonNegativeIntegerSchema = typeof NonNegativeIntegerSchema;

export namespace NonNegativeIntegerSchema {
	export type Type = z.infer<NonNegativeIntegerSchema>;
}
