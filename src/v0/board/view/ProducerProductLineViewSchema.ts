import { z } from "zod";
import { ActivationInputViewSchema } from "~/v0/board/view/ActivationInputViewSchema";
import { ItemTargetLimitViewSchema } from "~/v0/board/view/ItemTargetLimitViewSchema";

const IdSchema = z.string().min(1);

const ProducerProductLineOutputQuantityViewSchema = z.union([
	z.number().int().positive(),
	z
		.object({
			min: z.number().int().positive(),
			max: z.number().int().positive(),
		})
		.strict(),
]);

const ProducerProductLineEffectRequirementViewSchema = z
	.object({
		kind: z
			.enum([
				"grant.blockStart",
				"grant.require",
				"nearby.require",
			])
			.optional(),
		label: z.string().min(1),
		ready: z.boolean(),
	})
	.strict();

const EffectPolarityViewSchema = z.enum([
	"buff",
	"debuff",
	"neutral",
	"mixed",
]);

const ProducerProductLineDropEffectViewSchema = z
	.object({
		active: z.boolean(),
		impact: z.enum([
			"availability",
			"chance",
			"visibility",
		]),
		kind: z.string().min(1),
		label: z.string().min(1),
		ready: z.boolean(),
		result: z.string().min(1),
	})
	.strict();

const ProducerProductLineOutputViewSchema = z.object({
	itemId: IdSchema,
	ownedQuantity: z.number().int().nonnegative(),
	enabled: z.boolean().optional(),
	effects: z.array(ProducerProductLineDropEffectViewSchema).optional(),
	kind: z
		.enum([
			"chance",
			"guaranteed",
			"weighted",
		])
		.optional(),
	probability: z.number().min(0).max(1).optional(),
	quantity: ProducerProductLineOutputQuantityViewSchema.optional(),
	rollLabel: z.string().min(1).optional(),
	sort: z.number().optional(),
});

export const ProducerProductLineViewSchema = z
	.object({
		productId: IdSchema,
		name: z.string().min(1),
		lineKind: z.enum([
			"effect",
			"product",
		]),
		visible: z.boolean().optional(),
		effectPolarity: EffectPolarityViewSchema.optional(),
		isDefault: z.boolean(),
		durationMs: z.number().int().nonnegative(),
		inProgress: z.boolean(),
		producerQueuedJobs: z.number().int().nonnegative(),
		queueFull: z.boolean(),
		blocked: z.boolean(),
		effectLocked: z.boolean().optional(),
		deliveryBlocked: z.boolean().optional(),
		outputLimitBlocked: z.boolean().optional(),
		queueBlockedReason: z
			.enum([
				"delivery_blocked",
				"paused",
			])
			.optional(),
		queueSize: z.number().int().positive(),
		queuedJobs: z.number().int().nonnegative(),
		inputs: z.array(ActivationInputViewSchema),
		inputsReady: z.boolean(),
		inputsAvailable: z.boolean(),
		startAtMs: z.number().int().nonnegative().optional(),
		readyAtMs: z.number().int().nonnegative().optional(),
		remainingMs: z.number().int().nonnegative().optional(),
		pausedAtMs: z.number().int().nonnegative().optional(),
		progress: z.number().min(0).max(1).optional(),
		inputItemIds: z.array(IdSchema),
		effectDurationMultiplier: z.number().positive().optional(),
		effectBenefits: z.array(z.string().min(1)).optional(),
		effectBonusLines: z.array(z.string().min(1)).optional(),
		startRequirementsReady: z.boolean().optional(),
		effectRequirements: z.array(ProducerProductLineEffectRequirementViewSchema).optional(),
		targetLimits: z.array(ItemTargetLimitViewSchema).optional(),
		outputs: z.array(ProducerProductLineOutputViewSchema).optional(),
	})
	.superRefine((line, context) => {
		if (line.lineKind === "effect" && line.effectPolarity === undefined) {
			context.addIssue({
				code: "custom",
				message: "Effect product-line views must expose effectPolarity.",
				path: [
					"effectPolarity",
				],
			});
		}

		if (line.lineKind === "product" && line.effectPolarity !== undefined) {
			context.addIssue({
				code: "custom",
				message: "Product product-line views must not expose effectPolarity.",
				path: [
					"effectPolarity",
				],
			});
		}
	});

type ProducerProductLineViewSchema = typeof ProducerProductLineViewSchema;
export namespace ProducerProductLineViewSchema {
	export type Type = z.infer<ProducerProductLineViewSchema>;
}

export type ProducerProductLineView = ProducerProductLineViewSchema.Type;
