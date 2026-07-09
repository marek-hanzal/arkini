import { z } from "zod";

import { NonEmptyStringSchema } from "./NonEmptyStringSchema";

export const NonEmptyStringListSchema = z.tuple(
	[
		NonEmptyStringSchema,
	],
	NonEmptyStringSchema,
);

export type NonEmptyStringListSchema = typeof NonEmptyStringListSchema;

export namespace NonEmptyStringListSchema {
	export type Type = z.infer<NonEmptyStringListSchema>;
}
