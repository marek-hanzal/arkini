import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";

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

const ViewItemAssetSchema = z.object({
	src: z.string(),
	overlaySrc: z.string().optional(),
	render: z
		.enum([
			"plain",
			"blueprint",
		])
		.optional(),
});

const ViewItemSchema = z.object({
	id: IdSchema,
	name: z.string(),
	description: z.string(),
	label: z.string().optional(),
	assets: z.array(ViewItemAssetSchema).min(1),
	maxStackSize: z.number().int().positive(),
	storage: z.enum([
		"board",
		"inventory",
		"both",
	]),
	tags: z.array(z.string()),
	generatedEffects: z.array(ViewItemGeneratedEffectSchema),
});

export type ViewItemAsset = z.infer<typeof ViewItemAssetSchema>;
export type ViewItemGeneratedEffect = z.infer<typeof ViewItemGeneratedEffectSchema>;
export type ViewItem = z.infer<typeof ViewItemSchema>;
