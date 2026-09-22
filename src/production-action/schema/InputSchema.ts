import { z } from "zod";

import { UnitsSchema } from "~/production-input/schema/UnitsSchema";
import { SimpleSchema } from "~/production-input/schema/SimpleSchema";

/** A non-material requirement shared by production admission. */
export const InputSchema = z
	.discriminatedUnion("type", [
		SimpleSchema,
		UnitsSchema,
	])
	.meta({
		id: "action.InputSchema",
		description: "A simple or board-units requirement resolved by an immediate item action.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
