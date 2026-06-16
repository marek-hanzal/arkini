import { z } from "zod";

export const ActionVisualAnimationModeSchema = z.enum([
	"parallel",
	"sequence",
	"instant",
]);

export const ActionVisualAnimationEffectSchema = z.enum([
	"move",
	"fade-in",
	"merge",
	"consume",
	"state",
]);

export const ActionVisualAnimationCauseSchema = z.enum([
	"move",
	"swap",
	"merge",
	"producer",
	"stash",
	"inventory",
	"craft",
	"upgrade",
	"activation",
]);

export const ActionVisualAnimationSchema = z.object({
	groupId: z.string().min(1),
	mode: ActionVisualAnimationModeSchema,
	effect: ActionVisualAnimationEffectSchema,
	cause: ActionVisualAnimationCauseSchema,
	sequenceIndex: z.number().int().nonnegative().optional(),
	delayMs: z.number().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
});

type ActionVisualAnimationSchema = typeof ActionVisualAnimationSchema;
export namespace ActionVisualAnimationSchema {
	export type Type = z.infer<ActionVisualAnimationSchema>;
}
