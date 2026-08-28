import { z } from "zod";

import { DepositSchema } from "~/engine/input/schema/DepositSchema";
import { SimpleSchema } from "~/engine/input/schema/SimpleSchema";

/** One immediate item-action requirement without Line-owned material buffering. */
export const InputSchema = z
	.discriminatedUnion("type", [
		SimpleSchema,
		DepositSchema,
	])
	.meta({
		id: "action.InputSchema",
		description: "A simple or board-deposit requirement resolved by an immediate item action.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
