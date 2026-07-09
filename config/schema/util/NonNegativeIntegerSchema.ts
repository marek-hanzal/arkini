import { z } from "zod";

export const NonNegativeIntegerSchema = z.number().int().min(0);

export type NonNegativeIntegerSchema = typeof NonNegativeIntegerSchema;

export namespace NonNegativeIntegerSchema {
	export type Type = z.infer<NonNegativeIntegerSchema>;
}
