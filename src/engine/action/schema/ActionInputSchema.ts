import { z } from "zod";

import { InputDepositSchema } from "~/engine/input/schema/InputDepositSchema";
import { InputSimpleSchema } from "~/engine/input/schema/InputSimpleSchema";

/** One immediate item-action requirement without Line-owned material buffering. */
export const ActionInputSchema = z
	.discriminatedUnion("type", [
		InputSimpleSchema,
		InputDepositSchema,
	])
	.meta({
		id: "ActionInputSchema",
		description: "A simple or board-deposit requirement resolved by an immediate item action.",
	});

export type ActionInputSchema = typeof ActionInputSchema;

export namespace ActionInputSchema {
	export type Type = z.infer<ActionInputSchema>;
}
