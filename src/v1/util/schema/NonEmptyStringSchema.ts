import { z } from "zod";

export const NonEmptyStringSchema = z.string().trim().min(1);

export type NonEmptyStringSchema = typeof NonEmptyStringSchema;

export namespace NonEmptyStringSchema {
	export type Type = z.infer<NonEmptyStringSchema>;
}
