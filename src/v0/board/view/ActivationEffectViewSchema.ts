import { z } from "zod";

const ActivationEffectImpactViewSchema = z.enum([
	"availability",
	"chance",
	"visibility",
]);

export const ActivationEffectViewSchema = z
	.object({
		active: z.boolean(),
		impact: ActivationEffectImpactViewSchema,
		kind: z.string().min(1),
		label: z.string().min(1),
		ready: z.boolean(),
		result: z.string().min(1),
	})
	.strict();
