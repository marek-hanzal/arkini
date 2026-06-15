import { z } from "zod";

export const ActivationModeSchema = z.enum([
	"single",
	"exhaust",
]);

type ActivationModeSchema = typeof ActivationModeSchema;
export namespace ActivationModeSchema {
	export type Type = z.infer<ActivationModeSchema>;
}
