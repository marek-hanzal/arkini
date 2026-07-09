import { z } from "zod";

import { NonEmptyStringSchema } from "./NonEmptyStringSchema";

export const NonEmptyStringListSchema = z
	.tuple(
		[
			NonEmptyStringSchema,
		],
		NonEmptyStringSchema,
	)
	.meta({
		id: "NonEmptyStringListSchema",
		description: "A non-empty ordered list of non-empty strings.",
	});

export type NonEmptyStringListSchema = typeof NonEmptyStringListSchema;

export namespace NonEmptyStringListSchema {
	export type Type = z.infer<NonEmptyStringListSchema>;
}
