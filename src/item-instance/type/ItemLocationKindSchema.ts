import { z } from "zod";

export const ItemLocationKindSchema = z.enum([
	"board",
	"inventory",
	"activation-input",
]);

type ItemLocationKindSchema = typeof ItemLocationKindSchema;
export namespace ItemLocationKindSchema {
	export type Type = z.infer<ItemLocationKindSchema>;
}
