import { z } from "zod";
import { ActivationInputViewSchema } from "./ActivationInputViewSchema";
import { ActivationRequirementViewSchema } from "./ActivationRequirementViewSchema";
import { ProducerProductLineViewSchema } from "./ProducerProductLineViewSchema";

export const ActivationViewSchema = z.object({
	kind: z.enum([
		"producer",
		"stash",
	]),
	trigger: z.literal("click"),
	cooldownMs: z.number().optional(),
	cooldownUntil: z.string().optional(),
	cooldownUntilMs: z.number().optional(),
	remainingCharges: z.number().optional(),
	productLines: z.array(ProducerProductLineViewSchema).optional(),
	inputs: z.array(ActivationInputViewSchema),
	requirements: z.array(ActivationRequirementViewSchema),
});

type ActivationViewSchema = typeof ActivationViewSchema;
export namespace ActivationViewSchema {
	export type Type = z.infer<ActivationViewSchema>;
}

export type ActivationView = ActivationViewSchema.Type;
