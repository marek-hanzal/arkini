import { z } from "zod";
import { ActivationDropViewSchema } from "./ActivationDropViewSchema";
import { ActivationInputViewSchema } from "./ActivationInputViewSchema";
import { ProducerLineViewSchema } from "./ProducerLineViewSchema";

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
	drops: z.array(ActivationDropViewSchema).optional(),
	deliveryBlocked: z.boolean().optional(),
	producerLines: z.array(ProducerLineViewSchema).optional(),
	inputs: z.array(ActivationInputViewSchema),
});

type ActivationViewSchema = typeof ActivationViewSchema;
export namespace ActivationViewSchema {
	export type Type = z.infer<ActivationViewSchema>;
}

export type ActivationView = ActivationViewSchema.Type;
