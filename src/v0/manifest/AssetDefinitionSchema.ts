import { z } from "zod";
import { GameAssetIdSchema } from "./GameAssetIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";

export const AssetDefinitionSchema = z.object({
	id: GameAssetIdSchema,
	kind: z.enum([
		"item",
		"ui",
	]),
	label: z.string().min(1),
	src: z.string().min(1),
	overlayAssetId: GameAssetIdSchema.optional(),
	render: z
		.enum([
			"plain",
			"blueprint",
		])
		.optional(),
	sort: NonNegativeIntegerSchema,
});

type AssetDefinitionSchema = typeof AssetDefinitionSchema;
export namespace AssetDefinitionSchema {
	export type Type = z.infer<AssetDefinitionSchema>;
}
