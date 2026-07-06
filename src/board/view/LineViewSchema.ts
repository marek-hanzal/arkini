import { z } from "zod";
import { ActivationEffectViewSchema } from "~/board/view/ActivationEffectViewSchema";
import { ActivationInputViewSchema } from "~/board/view/ActivationInputViewSchema";
import { ItemTargetLimitViewSchema } from "~/board/view/ItemTargetLimitViewSchema";

const IdSchema = z.string().min(1);

const LineOutputQuantityViewSchema = z.union([
	z.number().int().positive(),
	z
		.object({
			min: z.number().int().positive(),
			max: z.number().int().positive(),
		})
		.strict(),
]);

const LineEffectRequirementViewSchema = z
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

const LineOutputViewSchema = z.object({
	itemId: IdSchema,
	bonusLines: z.array(z.string().min(1)).optional(),
	ownedQuantity: z.number().int().nonnegative(),
	enabled: z.boolean().optional(),
	effects: z.array(ActivationEffectViewSchema).optional(),
	kind: z
		.enum([
			"chance",
			"guaranteed",
			"weighted",
		])
		.optional(),
	probability: z.number().min(0).optional(),
	quantity: LineOutputQuantityViewSchema.optional(),
	rollLabel: z.string().min(1).optional(),
	sort: z.number().optional(),
});

export const LineViewSchema = z
	.object({
		lineId: IdSchema,
		name: z.string().min(1),
		kind: z.enum([
			"effect",
			"product",
		]),
		visible: z.boolean().optional(),
		effectPolarity: EffectPolarityViewSchema.optional(),
		isDefault: z.boolean(),
		durationMs: z.number().int().nonnegative(),
		inProgress: z.boolean(),
		queueUsed: z.number().int().nonnegative(),
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
		queueMax: z.number().int().positive(),
		jobs: z.number().int().nonnegative(),
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
		effectRequirements: z.array(LineEffectRequirementViewSchema).optional(),
		targetLimits: z.array(ItemTargetLimitViewSchema).optional(),
		outputs: z.array(LineOutputViewSchema).optional(),
	})
	.superRefine((line, context) => {
		if (line.kind === "effect" && line.effectPolarity === undefined) {
			context.addIssue({
				code: "custom",
				message: "Effect line views must expose effectPolarity.",
				path: [
					"effectPolarity",
				],
			});
		}

		if (line.kind === "product" && line.effectPolarity !== undefined) {
			context.addIssue({
				code: "custom",
				message: "Line views must not expose effectPolarity.",
				path: [
					"effectPolarity",
				],
			});
		}
	});

type LineViewSchema = typeof LineViewSchema;
export namespace LineViewSchema {
	export type Type = z.infer<LineViewSchema>;
}

export type LineView = LineViewSchema.Type;
