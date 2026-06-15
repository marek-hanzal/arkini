import { z } from "zod";

export const ActivationRuntimeStateSchema = z.object({
	cooldownUntil: z.string().optional(),
	remainingCharges: z.number().optional(),
});

type ActivationRuntimeStateSchema = typeof ActivationRuntimeStateSchema;
export namespace ActivationRuntimeStateSchema {
	export type Type = z.infer<ActivationRuntimeStateSchema>;
}
