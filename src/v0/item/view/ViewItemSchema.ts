import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";

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
	tags: z.array(z.string()),
	canProduce: z.boolean(),
	producerTrigger: z.literal("click").optional(),
	canMerge: z.boolean(),
	mergeResults: z
		.array(
			z.object({
				withItemId: GameItemIdSchema,
				resultItemId: GameItemIdSchema,
				secret: z.boolean().optional(),
			}),
		)
		.optional(),
	usedInCrafts: z
		.array(
			z.object({
				targetItemId: GameItemIdSchema,
				resultItemId: GameItemIdSchema,
			}),
		)
		.optional(),
	usedInMerges: z
		.array(
			z.object({
				targetItemId: GameItemIdSchema,
				resultItemId: GameItemIdSchema,
				secret: z.boolean().optional(),
			}),
		)
		.optional(),
});

type ViewItemSchema = typeof ViewItemSchema;
export namespace ViewItemSchema {
	export type Type = z.infer<ViewItemSchema>;
}

export type ViewItem = ViewItemSchema.Type;
