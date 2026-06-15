import { z } from "zod";

export const NonNegativeIntegerSchema = z.number().int().nonnegative();

type NonNegativeIntegerSchema = typeof NonNegativeIntegerSchema;
export namespace NonNegativeIntegerSchema {
	export type Type = z.infer<NonNegativeIntegerSchema>;
}
