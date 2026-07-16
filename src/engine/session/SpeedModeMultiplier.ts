import type { SpeedModeSchema } from "~/engine/session/schema/SpeedModeSchema";

/** Converts newly observed wall-clock milliseconds into simulation milliseconds. */
export const SpeedModeMultiplier = {
	normal: 1,
	accelerated: 30,
} as const satisfies Record<SpeedModeSchema.Type, number>;
