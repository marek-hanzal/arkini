import { z } from "zod";

/** The authored cause that may admit a line. One line has exactly one trigger. */
export const LineTriggerEnumSchema = z.enum([
	"manual",
	"clock-interval",
	"item-termination",
]);

export type LineTriggerEnumSchema = typeof LineTriggerEnumSchema;

export namespace LineTriggerEnumSchema {
	export type Type = z.infer<LineTriggerEnumSchema>;
}
