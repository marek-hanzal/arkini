import { z } from "zod";

/** The accepted presentation outcome kind of one attempted runtime-item drop. */
export const DropItemResultKindEnumSchema = z
	.enum({
		Move: "move",
		Swap: "swap",
		Merge: "merge",
		StoreInput: "store-input",
		Stack: "stack",
		Ignored: "ignored",
		Reject: "reject",
	})
	.meta({
		id: "DropItemResultKindEnumSchema",
		description: "The accepted presentation outcome kind of one attempted runtime-item drop.",
	});

export type DropItemResultKindEnumSchema = typeof DropItemResultKindEnumSchema;

export namespace DropItemResultKindEnumSchema {
	export type Type = z.infer<DropItemResultKindEnumSchema>;
}
