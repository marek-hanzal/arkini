import { z } from "zod";

export const ItemEstimateViewSchema = z.enum([
	"fastest",
	"slowest",
	"demand",
	"incomplete",
]);

export type ItemEstimateViewSchema = typeof ItemEstimateViewSchema;

export namespace ItemEstimateViewSchema {
	export type Type = z.infer<ItemEstimateViewSchema>;
}
