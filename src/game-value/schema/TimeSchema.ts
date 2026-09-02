import { z } from "zod";

/**
 * A non-negative whole time value expressed in milliseconds.
 *
 * This scalar adds time-domain meaning to configuration values while allowing
 * instant operations to use zero milliseconds.
 */
export const TimeSchema = z.number().int().nonnegative().meta({
	id: "TimeSchema",
	description: "A non-negative whole time value expressed in milliseconds.",
});

export type TimeSchema = typeof TimeSchema;

export namespace TimeSchema {
	export type Type = z.infer<TimeSchema>;
}
