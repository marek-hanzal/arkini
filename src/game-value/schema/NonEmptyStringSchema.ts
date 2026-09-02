import { z } from "zod";

export const NonEmptyStringSchema = z.string().trim().min(1).meta({
	id: "NonEmptyStringSchema",
	description: "A trimmed non-empty string.",
});

export type NonEmptyStringSchema = typeof NonEmptyStringSchema;

export namespace NonEmptyStringSchema {
	export type Type = z.infer<NonEmptyStringSchema>;
}
