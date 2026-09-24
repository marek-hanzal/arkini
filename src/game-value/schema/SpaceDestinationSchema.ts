import { z } from "zod";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";

/** An authored destination; previous is resolved from committed navigation history. */
export const SpaceDestinationSchema = z
	.union([
		NonNegativeIntegerSchema,
		z.literal("previous"),
	])
	.meta({
		id: "SpaceDestinationSchema",
		description: "An exact Board space or the space the player last left successfully.",
	});
export type SpaceDestinationSchema = typeof SpaceDestinationSchema;
export namespace SpaceDestinationSchema {
	export type Type = z.infer<SpaceDestinationSchema>;
}
