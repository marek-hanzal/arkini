import { z } from "zod";

export const IdSchema = z.string().min(1);
export const NonNegativeIntegerSchema = z.number().int().min(0);
export const PositiveIntegerSchema = z.number().int().positive();
export const NonNegativeNumberSchema = z.number().min(0);
export const PositiveNumberSchema = z.number().positive();
export const PositiveProbabilitySchema = z.number().gt(0).max(1);
export const SortSchema = z.number().finite();

export const ActivationInputModeSchema = z.enum([
	"exact",
	"upTo",
]);
export const PlacementSchema = z
	.enum([
		"board_then_inventory",
	])
	.default("board_then_inventory");
export const ItemStoragePolicySchema = z
	.enum([
		"board",
		"inventory",
		"both",
	])
	.default("both");

export const QuantitySchema = z.union([
	PositiveIntegerSchema,
	z
		.object({
			min: PositiveIntegerSchema,
			max: PositiveIntegerSchema,
		})
		.strict()
		.refine((value) => value.max >= value.min, {
			message: "max must be >= min",
		}),
]);
