import { z } from "zod";

export const PositiveIntegerSchema = z.number().int().positive();

export type PositiveIntegerSchema = typeof PositiveIntegerSchema;

export namespace PositiveIntegerSchema {
	export type Type = z.infer<PositiveIntegerSchema>;
}
