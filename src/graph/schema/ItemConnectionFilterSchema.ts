import { z } from "zod";

export const ItemConnectionFilterSchema = z.enum([
	"all",
	"merges-into",
	"accepts-merge",
	"required-by",
	"inputs",
	"produces",
	"produced-by",
	"references",
	"referenced-by",
]);
export type ItemConnectionFilterSchema = typeof ItemConnectionFilterSchema;
export namespace ItemConnectionFilterSchema {
	export type Type = z.infer<ItemConnectionFilterSchema>;
}
