import { z } from "zod";

export const PositiveNumberSchema = z.number().positive().meta({
	id: "PositiveNumberSchema",
	description: "A number greater than zero.",
});

export type PositiveNumberSchema = typeof PositiveNumberSchema;

export namespace PositiveNumberSchema {
	export type Type = z.infer<PositiveNumberSchema>;
}
