import { z } from "zod";

export const ItemEstimateSortSchema = z.enum([
	"fastest",
	"slowest",
	"demand",
]);

export type ItemEstimateSortSchema = typeof ItemEstimateSortSchema;

export namespace ItemEstimateSortSchema {
	export type Type = z.infer<ItemEstimateSortSchema>;
}
