import { z } from "zod";

export const PositiveNumberSchema = z.number().positive();

export type PositiveNumberSchema = typeof PositiveNumberSchema;

export namespace PositiveNumberSchema {
	export type Type = z.infer<PositiveNumberSchema>;
}
