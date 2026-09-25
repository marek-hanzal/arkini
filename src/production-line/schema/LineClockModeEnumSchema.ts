import { z } from "zod";

/** One authored Clock role for a line; lifetime selection resolves its outcome at expiry. */
export const LineClockModeEnumSchema = z.enum([
	"clock-interval",
	"clock-lifetime",
]);

export type LineClockModeEnumSchema = typeof LineClockModeEnumSchema;

export namespace LineClockModeEnumSchema {
	export type Type = z.infer<LineClockModeEnumSchema>;
}
