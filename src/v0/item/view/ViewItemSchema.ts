import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

const ViewEffectPolaritySchema = z.enum([
	"buff",
	"debuff",
	"neutral",
	"mixed",
]);

const ViewItemGeneratedEffectGrantSchema = z.object({
	id: z.string(),
	name: z.string(),
});

const ViewItemGeneratedEffectSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	polarity: ViewEffectPolaritySchema,
	grants: z.array(ViewItemGeneratedEffectGrantSchema),
	sourceScope: z.enum([
		"board",
		"inventory",
		"both",
	]),
});

export const ViewItemSchema = z.object({
	id: GameItemIdSchema,
	name: z.string(),
	description: z.string(),
	label: z.string().optional(),
	assetSrc: z.string(),
	assetOverlaySrc: z.string().optional(),
	assetRender: z
		.enum([
			"plain",
			"blueprint",
		])
		.optional(),
	maxStackSize: z.number().int().positive(),
	storage: z.enum([
		"board",
		"inventory",
		"both",
	]),
	tags: z.array(z.string()),
	generatedEffects: z.array(ViewItemGeneratedEffectSchema),
});

type ViewItemSchema = typeof ViewItemSchema;
export namespace ViewItemSchema {
	export type Type = z.infer<ViewItemSchema>;
}

export type ViewItemGeneratedEffect = z.infer<typeof ViewItemGeneratedEffectSchema>;
export type ViewItem = ViewItemSchema.Type;
