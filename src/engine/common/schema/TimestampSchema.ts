import { z } from "zod";

/**
 * A non-negative whole Unix timestamp expressed in milliseconds.
 */
export const TimestampSchema = z.number().int().nonnegative().meta({
	id: "TimestampSchema",
	description: "A non-negative whole Unix timestamp expressed in milliseconds.",
});

export type TimestampSchema = typeof TimestampSchema;

export namespace TimestampSchema {
	export type Type = z.infer<TimestampSchema>;
}
