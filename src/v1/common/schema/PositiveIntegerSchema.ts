import { z } from "zod";

export const PositiveIntegerSchema = z.number().int().positive().meta({
	id: "PositiveIntegerSchema",
	description: "A whole number greater than zero.",
});

export type PositiveIntegerSchema = typeof PositiveIntegerSchema;

export namespace PositiveIntegerSchema {
	export type Type = z.infer<PositiveIntegerSchema>;
}
