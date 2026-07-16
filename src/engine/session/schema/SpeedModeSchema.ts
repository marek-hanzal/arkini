import { z } from "zod";

/** Selects how newly observed wall-clock time feeds the fixed-step simulation. */
export const SpeedModeSchema = z.enum([
	"normal",
	"accelerated",
]);

export type SpeedModeSchema = typeof SpeedModeSchema;

export namespace SpeedModeSchema {
	export type Type = z.infer<SpeedModeSchema>;
}
