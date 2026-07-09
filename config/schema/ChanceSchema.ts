import { z } from "zod";

export const ChanceSchema = z.number().min(0).max(1);

export type ChanceSchema = typeof ChanceSchema;

export namespace ChanceSchema {
	export type Type = z.infer<ChanceSchema>;
}
