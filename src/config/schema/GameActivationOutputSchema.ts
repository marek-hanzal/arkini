import { z } from "zod";
import {
	IdSchema,
	PositiveIntegerSchema,
	QuantitySchema,
	SortSchema,
} from "~/config/schema/GameConfigScalarSchemas";
import {
	GameDropEffectAuthoringSchema,
	GameDropEffectSchema,
} from "~/config/schema/GameDropEffectSchema";

const createActivationOutputSchema = <
	TDropEffectSchema extends typeof GameDropEffectSchema | typeof GameDropEffectAuthoringSchema,
>(
	dropEffectSchema: TDropEffectSchema,
) => {
	const dropEffectFields = {
		enabled: z.boolean().optional(),
		effects: z.array(dropEffectSchema).optional(),
		visibility: z
			.enum([
				"visible",
				"hidden",
			])
			.optional(),
	};

	return z.array(
		z.discriminatedUnion("type", [
			z
				.object({
					type: z.literal("guaranteed"),
					itemId: IdSchema,
					quantity: QuantitySchema.default(1),
					sort: SortSchema.optional(),
					...dropEffectFields,
				})
				.strict(),
			z
				.object({
					type: z.literal("chance"),
					itemId: IdSchema,
					chance: z.number().min(0).max(1),
					quantity: QuantitySchema.default(1),
					sort: SortSchema.optional(),
					...dropEffectFields,
				})
				.strict(),
			z
				.object({
					type: z.literal("weighted"),
					rolls: QuantitySchema.default(1),
					sort: SortSchema.optional(),
					entries: z
						.array(
							z
								.object({
									itemId: IdSchema,
									weight: PositiveIntegerSchema,
									quantity: QuantitySchema.default(1),
									sort: SortSchema.optional(),
									...dropEffectFields,
								})
								.strict(),
						)
						.min(1),
				})
				.strict(),
		]),
	);
};

export const ActivationOutputSchema = createActivationOutputSchema(GameDropEffectSchema);
export const ActivationOutputAuthoringSchema = createActivationOutputSchema(
	GameDropEffectAuthoringSchema,
);
